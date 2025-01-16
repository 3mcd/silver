## Identifiers

### Entity

Entities are 32-bit integers divided into 20- and 11-bit parts.

The 11-bit part is the local client id. A client id of 0 is assigned to entities created before the client was identified by the server. The 20-bit part is an auto-incrementing index. This means there can be 2048 clients, each controlling up to 1,048,576 entities.

### Component

Components are 53-bit integers divided into 32- and 21-bit parts. The 21-bit part is the component id. The remaining 32 bits are used to identify the entity to which the component belongs in the case of a pair component.
