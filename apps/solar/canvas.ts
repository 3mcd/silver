export const canvas = document.querySelector("canvas")!
export const context = canvas.getContext("2d")!
export const transform = {scale: 1, x: 0, y: 0}

const dpr = window.devicePixelRatio

const scale = (s: number) => {
  context.scale(s, s)
  transform.scale *= 1 / s
  transform.x *= 1 / s
  transform.y *= 1 / s
}

export const translate = (dx: number, dy: number) => {
  context.translate(dx, dy)
  transform.x -= dx
  transform.y -= dy
}

const transformX = (x: number) => transform.scale * x + transform.x
const transformY = (y: number) => transform.scale * y + transform.y

let dragging = false

const onMousedown = () => {
  dragging = true
}

const onMousemove = (e: MouseEvent) => {
  if (dragging) {
    translate(e.movementX * transform.scale, e.movementY * transform.scale)
  }
}

const onMouseup = () => {
  dragging = false
}

const onWheel = (e: WheelEvent) => {
  const s = Math.sign(e.deltaY) > 0 ? 0.9 : 1.1
  const tx = transformX(e.pageX * dpr - canvas.offsetLeft)
  const ty = transformY(e.pageY * dpr - canvas.offsetTop)
  translate(tx, ty)
  scale(s)
  translate(-tx, -ty)
}

canvas.addEventListener("wheel", onWheel)
canvas.addEventListener("mousedown", onMousedown)
canvas.addEventListener("mousemove", onMousemove)
canvas.addEventListener("mouseup", onMouseup)

const resize = () => {
  const width = window.innerWidth
  const height = window.innerHeight
  canvas.style.width = width + "px"
  canvas.style.height = height + "px"
  canvas.width = width * dpr
  canvas.height = height * dpr
}

export const clear = () => {
  const left = transformX(0)
  const top = transformY(0)
  const width = Math.abs(transformX(context.canvas.width) - left)
  const height = Math.abs(transformY(context.canvas.height) - top)
  context.fillStyle = "black"
  context.fillRect(left, top, width, height)
}

window.addEventListener("resize", resize)

resize()

export const circle = (color: string, radius: number) => {
  context.fillStyle = color
  context.beginPath()
  context.arc(0, 0, radius, 0, 2 * Math.PI, true)
  context.closePath()
  context.fill()
}

export const arc = (
  color: string,
  radius: number,
  start: number,
  end: number,
  width: number,
) => {
  context.lineWidth = width
  context.strokeStyle = color
  context.beginPath()
  context.arc(0, 0, radius, start, end)
  context.stroke()
  context.closePath()
}

const getCursorPosition = (event: MouseEvent) => {
  const x =
    transformX(event.clientX * dpr - canvas.offsetLeft) - canvas.width / 2
  const y =
    transformY(event.clientY * dpr - canvas.offsetTop) - canvas.height / 2
  return {x, y}
}

export type Click = {x: number; y: number}

export const clicks = [] as Click[]

let lastMousedownTime: number
canvas.addEventListener("mousedown", () => {
  lastMousedownTime = performance.now()
})
canvas.addEventListener("mouseup", event => {
  const mousedownDuration = performance.now() - lastMousedownTime
  if (mousedownDuration < 200) {
    clicks.push(getCursorPosition(event))
  }
})
