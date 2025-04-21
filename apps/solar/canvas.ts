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

export let center = () => {
  context.translate(canvas.width / 2, canvas.height / 2)
}

export let to_world_x = (x: number) => transform.scale * x + transform.x
export let to_world_y = (y: number) => transform.scale * y + transform.y

let dragging = false

let on_mousedown = () => {
  dragging = true
}

let on_mousemove = (e: MouseEvent) => {
  if (dragging) {
    translate(e.movementX * transform.scale, e.movementY * transform.scale)
  }
}

let on_mouseup = () => {
  dragging = false
}

let on_wheel = (e: WheelEvent) => {
  let s = Math.sign(e.deltaY) > 0 ? 0.9 : 1.1
  let tx = to_world_x(e.pageX * dpr - canvas.offsetLeft)
  let ty = to_world_y(e.pageY * dpr - canvas.offsetTop)
  translate(tx, ty)
  scale(s)
  translate(-tx, -ty)
}

canvas.addEventListener("wheel", on_wheel, {passive: true})
canvas.addEventListener("mousedown", on_mousedown)
canvas.addEventListener("mousemove", on_mousemove)
canvas.addEventListener("mouseup", on_mouseup)

let resize = () => {
  let width = window.innerWidth
  let height = window.innerHeight
  canvas.style.width = width + "px"
  canvas.style.height = height + "px"
  canvas.width = width * dpr
  canvas.height = height * dpr
}

export let clear = () => {
  let left = to_world_x(0)
  let top = to_world_y(0)
  let width = Math.abs(to_world_x(context.canvas.width) - left)
  let height = Math.abs(to_world_y(context.canvas.height) - top)
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
  line_width: number,
) => {
  context.lineWidth = line_width
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
  line_width: number,
) => {
  context.lineWidth = line_width
  context.strokeStyle = color
  context.strokeRect(0, 0, width, height)
}

let asset_map = new Map<string, HTMLImageElement>()

context.imageSmoothingEnabled = false

export let image = (src: string, width: number, height: number) => {
  let img = asset_map.get(src)
  if (img === undefined) {
    img = new Image()
    img.src = src
    asset_map.set(src, img)
  }
  if (img.complete) {
    context.drawImage(img, -width / 2, -height / 2, width, height)
  }
}
