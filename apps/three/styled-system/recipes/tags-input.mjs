import { splitProps, getSlotCompoundVariant } from '../helpers.mjs';
import { createRecipe } from './create-recipe.mjs';

const tagsInputDefaultVariants = {
  "size": "md"
}
const tagsInputCompoundVariants = []

const tagsInputSlotNames = [
  [
    "root",
    "tagsInput__root"
  ],
  [
    "label",
    "tagsInput__label"
  ],
  [
    "control",
    "tagsInput__control"
  ],
  [
    "input",
    "tagsInput__input"
  ],
  [
    "clearTrigger",
    "tagsInput__clearTrigger"
  ],
  [
    "item",
    "tagsInput__item"
  ],
  [
    "itemInput",
    "tagsInput__itemInput"
  ],
  [
    "itemText",
    "tagsInput__itemText"
  ],
  [
    "itemDeleteTrigger",
    "tagsInput__itemDeleteTrigger"
  ]
]
const tagsInputSlotFns = /* @__PURE__ */ tagsInputSlotNames.map(([slotName, slotKey]) => [slotName, createRecipe(slotKey, tagsInputDefaultVariants, getSlotCompoundVariant(tagsInputCompoundVariants, slotName))])

const tagsInputFn = (props = {}) => {
  return Object.fromEntries(tagsInputSlotFns.map(([slotName, slotFn]) => [slotName, slotFn(props)]))
}

const tagsInputVariantKeys = [
  "size"
]

export const tagsInput = /* @__PURE__ */ Object.assign(tagsInputFn, {
  __recipe__: false,
  __name__: 'tagsInput',
  raw: (props) => props,
  variantKeys: tagsInputVariantKeys,
  variantMap: {
  "size": [
    "md"
  ]
},
  splitVariantProps(props) {
    return splitProps(props, tagsInputVariantKeys)
  },
})