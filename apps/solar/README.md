# solar

A highly inaccurate 2d solar system simulation that demonstrates components, relationships, queries, and query filters.

### Getting started

Run `pnpm start` and visit http://localhost:5173.

### Controls

Zoom and pan using a mouse or touchpad. Click and drag to move the camera. Use the scroll wheel to zoom in and out.

Clicking an astronomical object will delete it. Satellites will be deleted along with the body they orbit because they are related through a hierarchical relationship ([`ecs.Topology.Hierarchical`](./src/data.ts#L10)).