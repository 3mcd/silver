import { splitProps, getSlotCompoundVariant } from '../helpers.mjs';
import { createRecipe } from './create-recipe.mjs';

const colorPickerDefaultVariants = {}
const colorPickerCompoundVariants = []

const colorPickerSlotNames = [
  [
    "root",
    "colorPicker__root"
  ],
  [
    "label",
    "colorPicker__label"
  ],
  [
    "control",
    "colorPicker__control"
  ],
  [
    "trigger",
    "colorPicker__trigger"
  ],
  [
    "positioner",
    "colorPicker__positioner"
  ],
  [
    "content",
    "colorPicker__content"
  ],
  [
    "area",
    "colorPicker__area"
  ],
  [
    "areaThumb",
    "colorPicker__areaThumb"
  ],
  [
    "areaBackground",
    "colorPicker__areaBackground"
  ],
  [
    "channelSlider",
    "colorPicker__channelSlider"
  ],
  [
    "channelSliderTrack",
    "colorPicker__channelSliderTrack"
  ],
  [
    "channelSliderThumb",
    "colorPicker__channelSliderThumb"
  ],
  [
    "channelInput",
    "colorPicker__channelInput"
  ],
  [
    "transparencyGrid",
    "colorPicker__transparencyGrid"
  ],
  [
    "swatchGroup",
    "colorPicker__swatchGroup"
  ],
  [
    "swatchTrigger",
    "colorPicker__swatchTrigger"
  ],
  [
    "swatch",
    "colorPicker__swatch"
  ],
  [
    "eyeDropperTrigger",
    "colorPicker__eyeDropperTrigger"
  ],
  [
    "valueText",
    "colorPicker__valueText"
  ],
  [
    "view",
    "colorPicker__view"
  ]
]
const colorPickerSlotFns = /* @__PURE__ */ colorPickerSlotNames.map(([slotName, slotKey]) => [slotName, createRecipe(slotKey, colorPickerDefaultVariants, getSlotCompoundVariant(colorPickerCompoundVariants, slotName))])

const colorPickerFn = (props = {}) => {
  return Object.fromEntries(colorPickerSlotFns.map(([slotName, slotFn]) => [slotName, slotFn(props)]))
}

const colorPickerVariantKeys = []

export const colorPicker = /* @__PURE__ */ Object.assign(colorPickerFn, {
  __recipe__: false,
  __name__: 'colorPicker',
  raw: (props) => props,
  variantKeys: colorPickerVariantKeys,
  variantMap: {},
  splitVariantProps(props) {
    return splitProps(props, colorPickerVariantKeys)
  },
})