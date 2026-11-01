// Kingdom of the Fairies: numbers to tweak. Edit and reload; the game and the tests both
// read this file. (Plain JavaScript so it loads without a build step: keep the
// `export default { ... }` shape and the trailing commas are fine.)

export default {
  act1: {
    // Lanterns of hull the ship sets out with (and the most it can hold).
    lanterns: 3,
    // Pearls that restore one lantern. Each pearl restores 1/pearlsPerLantern
    // of a lantern, so with 10, ten pearls let you take one more hit. Pearls
    // gathered at full hull are just score. Set to 0 to turn healing off.
    pearlsPerLantern: 10,
  },
};
