export type Item = {
  title: string
  value: string | number
  confirmTitle?: string
}

export interface IInfoBoxProps {
  title: string
  data: Item[]
  open?: boolean
}
