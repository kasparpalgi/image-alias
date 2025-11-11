# Image Alias (in Estonian language)

Add players and hand the phone to the next player who will clcik on the button to see the image that needs to explained to others without guessing. If someone guesses the image then the player will click on the person's name who guessed it and the game will display to whom the phone needs to be handed next. 

Images are loaded from [src/lib/assets/images.json](src/lib/assets/images.json) or searched from WikiMedia. If you want to upload your own images to [Min.io S3](https://www.min.io/) then add images in eg. `CARROT.png` format to [image-upload/images](image-upload/images) where are already bunch of images to start off. Then go to [/image-upload](image-upload) folder and rename the `.env.example` file and add your Min.io creditentials. Run `npm i` and `node index` to install and upload & generate the JSON mentioned above.

## Developing

Install: `npm install` (or `pnpm install` or `yarn`), then start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.