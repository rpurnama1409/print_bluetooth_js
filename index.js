"use strict";
var DATA =
  "" +
  "\x1B" +
  "\x61" +
  "\x31" +
  "\x1D" +
  "\x21" +
  "\x01" +
  "Rumah Makan Sederhana" +
  "\x1D" +
  "\x21" +
  "\x00" +
  "\n" +
  "Jalan Panday Sumedang selatan" +
  "\x0A\x0A" +
  "--------------------------------" +
  "\n" +
  "\x1b\x61\x00\x1b\x21\x00" +
  "Nama           : Ucupss" +
  "\n" +
  "No Meja        : 3" +
  "\n" +
  "No.Transaksi   : PNJ0002" +
  "\n" +
  "Tipe transaksi : DINE IN" +
  "\n" +
  "Tanggal        : 22-10-2022" +
  "\n" +
  "Jam            : 22:22:22" +
  "\n" +
  "--------------------------------" +
  "\n" +
  "Nasi Goreng        111 1,000,000" +
  "\n" +
  "--------------------------------" +
  "\n" +
  "             Total    4,000,000" +
  "\n" +
  "             PPN      4,000" +
  "\n" +
  "             Subtotal 44,000" +
  "\n" +
  "             Bayar    50,000" +
  "\n" +
  "             Kembali  6,000" +
  "\n\n\n" +
  "\x1B" +
  "\x61" +
  "\x31" +
  "Terimakasih telah berbelanja" +
  "\x0A\x0A";

document.addEventListener("WebComponentsReady", function () {
  let progress = document.querySelector("#progress");
  let dialog = document.querySelector("#dialog");
  let message = document.querySelector("#message");
  let printButton = document.querySelector("#print");
  let printCharacteristic;
  let index = 0;
  let text_idx = 0;
  let data;
  let text;
  progress.hidden = true;

  let image = document.querySelector("#image");
  // Use the canvas to get image data
  let canvas = document.createElement("canvas");
  // Canvas dimensions need to be a multiple of 40 for this printer
  canvas.width = 120;
  canvas.height = 120;
  let context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;

  function getDarkPixel(x, y) {
    // Return the pixels that will be printed black
    let red = imageData[(canvas.width * y + x) * 4];
    let green = imageData[(canvas.width * y + x) * 4 + 1];
    let blue = imageData[(canvas.width * y + x) * 4 + 2];
    return red + green + blue > 0 ? 1 : 0;
  }

  function getImagePrintData() {
    if (imageData == null) {
      console.log("No image to print!");
      return new Uint8Array([]);
    }
    // Each 8 pixels in a row is represented by a byte
    let printData = new Uint8Array((canvas.width / 8) * canvas.height + 8);
    let offset = 0;
    // Set the header bytes for printing the image
    printData[0] = 29; // Print raster bitmap
    printData[1] = 118; // Print raster bitmap
    printData[2] = 48; // Print raster bitmap
    printData[3] = 0; // Normal 203.2 DPI
    printData[4] = canvas.width / 8; // Number of horizontal data bits (LSB)
    printData[5] = 0; // Number of horizontal data bits (MSB)
    printData[6] = canvas.height % 256; // Number of vertical data bits (LSB)
    printData[7] = canvas.height / 256; // Number of vertical data bits (MSB)
    offset = 7;
    // Loop through image rows in bytes
    for (let i = 0; i < canvas.height; ++i) {
      for (let k = 0; k < canvas.width / 8; ++k) {
        let k8 = k * 8;
        //  Pixel to bit position mapping
        printData[++offset] =
          getDarkPixel(k8 + 0, i) * 128 +
          getDarkPixel(k8 + 1, i) * 64 +
          getDarkPixel(k8 + 2, i) * 32 +
          getDarkPixel(k8 + 3, i) * 16 +
          getDarkPixel(k8 + 4, i) * 8 +
          getDarkPixel(k8 + 5, i) * 4 +
          getDarkPixel(k8 + 6, i) * 2 +
          getDarkPixel(k8 + 7, i);
      }
    }
    return printData;
  }

  function handleError(error) {
    console.log(error);
    progress.hidden = true;
    printCharacteristic = null;
    dialog.open();
  }

  function sendNextImageDataBatch(resolve, reject) {
    // Can only write 512 bytes at a time to the characteristic
    // Need to send the image data in 512 byte batches
    if (index + 2048 < data.length) {
      printCharacteristic
        .writeValue(data.slice(index, index + 2048))
        .then(() => {
          index += 2048;
          sendNextImageDataBatch(resolve, reject);
        })
        .catch((error) => reject(error));
    } else {
      // Send the last bytes
      if (index < data.length) {
        printCharacteristic
          .writeValue(data.slice(index, data.length))
          .then(() => {
            resolve();
          })
          .catch((error) => reject(error));
      } else {
        resolve();
      }
    }
  }

  function sendImageData() {
    index = 0;
    data = getImagePrintData();
    return new Promise(function (resolve, reject) {
      sendNextImageDataBatch(resolve, reject);
    });
  }

  function sendTextData() {
    text_idx = 0;
    // Get the bytes for the text
    let encoder = new TextEncoder("utf-32");
    // Add line feed + carriage return chars to text
    text = encoder.encode(DATA + "\u000A\u000D");
    // return printCharacteristic.writeValue(text).then(() => {
    //   console.log('Write done.');
    // });

    return new Promise(function (resolve, reject) {
      sendTextDataBatch(resolve, reject);
    });
  }

  function sendTextDataBatch(resolve, reject) {
    if (text_idx + 512 < text.length) {
      printCharacteristic
        .writeValue(text.slice(text_idx, text_idx + 512))
        .then(() => {
          text_idx += 512;
          sendTextDataBatch(resolve, reject);
        })
        .catch((error) => reject(error));
    } else {
      // Send the last bytes
      if (text_idx < text.length) {
        printCharacteristic
          .writeValue(text.slice(text_idx, text.length))
          .then(() => {
            resolve();
          })
          .catch((error) => reject(error));
      } else {
        resolve();
      }
    }
  }

  function sendPrinterData() {
    sendTextData();
    // Print an image followed by the text
    // sendImageData()
    // .then()
    // .then(() => {
    //   progress.hidden = true;
    // })
    // .catch(handleError);
  }

  printButton.addEventListener("click", function () {
    progress.hidden = false;
    if (printCharacteristic == null) {
      navigator.bluetooth
        .requestDevice({
          filters: [
            {
              services: ["000018f0-0000-1000-8000-00805f9b34fb"],
            },
          ],
        })
        .then((device) => {
          console.log("> Found " + device.name);
          console.log("Connecting to GATT Server...");
          return device.gatt.connect();
        })
        .then((server) =>
          server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb")
        )
        .then((service) =>
          service.getCharacteristic("00002af1-0000-1000-8000-00805f9b34fb")
        )
        .then((characteristic) => {
          // Cache the characteristic
          printCharacteristic = characteristic;
          sendPrinterData();
        })
        .catch(handleError);
    } else {
      sendPrinterData();
    }
  });
});
