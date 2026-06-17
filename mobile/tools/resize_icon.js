const Jimp = require('jimp');

async function main() {
  console.log("Loading image...");
  const image = await Jimp.read('../assets/images/app_icon.png');
  
  console.log("Auto-cropping transparent pixels...");
  image.autocrop();

  console.log("Scaling image to safely fit inside Adaptive Icon safe zone (600x600 inside 1024x1024 canvas)...");
  image.scaleToFit(600, 600);

  console.log("Creating new 1024x1024 transparent canvas...");
  const canvas = await new Jimp(1024, 1024, 0x00000000);

  console.log("Compositing cropped image into the center of the canvas...");
  const x = (1024 - image.getWidth()) / 2;
  const y = (1024 - image.getHeight()) / 2;
  
  canvas.composite(image, x, y);

  console.log("Saving new app_icon.png...");
  await canvas.writeAsync('../assets/images/app_icon.png');
  console.log("Done!");
}

main().catch(console.error);
