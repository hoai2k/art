// Surface kinds stored per triangle in world.collider.geometry.attributes.surface
// (see ARCHITECTURE.md, "The World contract"). Shared by the town and the squirrel.
export const SURFACE = Object.freeze({
  ground: 0, road: 1, sidewalk: 2, grass: 3,
  wall_brick: 4, wall_stone: 5, wall_wood: 6, wall_smooth: 7,
  roof: 8, bark: 9, branch: 10, water_bed: 11, prop: 12, fence: 13,
});

const CLIMBABLE = new Set([SURFACE.wall_brick, SURFACE.wall_stone, SURFACE.wall_wood, SURFACE.bark, SURFACE.branch, SURFACE.fence]);

// Can the squirrel cling to this surface?
export const climbable = (id) => CLIMBABLE.has(id);
