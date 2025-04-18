export let canvas = document.querySelector("canvas")!
export let context = canvas.getContext("2d")!
export let transform = {scale: 1, x: 0, y: 0}

let dpr = window.devicePixelRatio

let scale = (s: number) => {
  context.scale(s, s)
  transform.scale *= 1 / s
  transform.x *= 1 / s
  transform.y *= 1 / s
}

export let translate = (dx: number, dy: number) => {
  context.translate(dx, dy)
  transform.x -= dx
  transform.y -= dy
}

export let transformX = (x: number) => transform.scale * x + transform.x
export let transformY = (y: number) => transform.scale * y + transform.y

let dragging = false

let onMousedown = () => {
  dragging = true
}

let onMousemove = (e: MouseEvent) => {
  if (dragging) {
    translate(e.movementX * transform.scale, e.movementY * transform.scale)
  }
}

let onMouseup = () => {
  dragging = false
}

let onWheel = (e: WheelEvent) => {
  let s = Math.sign(e.deltaY) > 0 ? 0.9 : 1.1
  let tx = transformX(e.pageX * dpr - canvas.offsetLeft)
  let ty = transformY(e.pageY * dpr - canvas.offsetTop)
  translate(tx, ty)
  scale(s)
  translate(-tx, -ty)
}

canvas.addEventListener("wheel", onWheel, {passive: true})
canvas.addEventListener("mousedown", onMousedown)
canvas.addEventListener("mousemove", onMousemove)
canvas.addEventListener("mouseup", onMouseup)

let resize = () => {
  let width = window.innerWidth
  let height = window.innerHeight
  canvas.style.width = width + "px"
  canvas.style.height = height + "px"
  canvas.width = width * dpr
  canvas.height = height * dpr
}

export let clear = () => {
  let left = transformX(0)
  let top = transformY(0)
  let width = Math.abs(transformX(context.canvas.width) - left)
  let height = Math.abs(transformY(context.canvas.height) - top)
  context.fillStyle = "black"
  context.fillRect(left, top, width, height)
}

window.addEventListener("resize", resize)

resize()

export let circle = (color: string, radius: number) => {
  context.fillStyle = color
  context.beginPath()
  context.arc(0, 0, radius, 0, 2 * Math.PI, true)
  context.closePath()
  context.fill()
}

export let arc = (
  color: string,
  radius: number,
  start: number,
  end: number,
  lineWidth: number,
) => {
  context.lineWidth = lineWidth
  context.strokeStyle = color
  context.beginPath()
  context.arc(0, 0, radius, start, end)
  context.stroke()
  context.closePath()
}

export let rect = (
  color: string,
  width: number,
  height: number,
  lineWidth: number,
) => {
  context.lineWidth = lineWidth
  context.strokeStyle = color
  context.strokeRect(0, 0, width, height)
}
