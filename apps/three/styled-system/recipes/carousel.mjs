import { splitProps, getSlotCompoundVariant } from '../helpers.mjs';
import { createRecipe } from './create-recipe.mjs';

const carouselDefaultVariants = {
  "size": "md"
}
const carouselCompoundVariants = []

const carouselSlotNames = [
  [
    "root",
    "carousel__root"
  ],
  [
    "viewport",
    "carousel__viewport"
  ],
  [
    "itemGroup",
    "carousel__itemGroup"
  ],
  [
    "item",
    "carousel__item"
  ],
  [
    "nextTrigger",
    "carousel__nextTrigger"
  ],
  [
    "prevTrigger",
    "carousel__prevTrigger"
  ],
  [
    "indicatorGroup",
    "carousel__indicatorGroup"
  ],
  [
    "indicator",
    "carousel__indicator"
  ],
  [
    "control",
    "carousel__control"
  ]
]
const carouselSlotFns = /* @__PURE__ */ carouselSlotNames.map(([slotName, slotKey]) => [slotName, createRecipe(slotKey, carouselDefaultVariants, getSlotCompoundVariant(carouselCompoundVariants, slotName))])

const carouselFn = (props = {}) => {
  return Object.fromEntries(carouselSlotFns.map(([slotName, slotFn]) => [slotName, slotFn(props)]))
}

const carouselVariantKeys = [
  "size"
]

export const carousel = /* @__PURE__ */ Object.assign(carouselFn, {
  __recipe__: false,
  __name__: 'carousel',
  raw: (props) => props,
  variantKeys: carouselVariantKeys,
  variantMap: {
  "size": [
    "sm",
    "md"
  ]
},
  splitVariantProps(props) {
    return splitProps(props, carouselVariantKeys)
  },
})