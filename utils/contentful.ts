import { IImageAndTextFields } from '../@types/generated/contentful'

export const contentfulImage = (image: IImageAndTextFields['image']) => {
  return `https://${image.fields.file.url.slice(2)}`
}
