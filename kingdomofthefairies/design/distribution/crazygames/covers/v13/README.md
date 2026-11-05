# Cover pack: diffuse title shading

The generated alpha lettering and text-free masters are preserved unchanged
from v12. The earlier covers were inspected to distinguish their broad,
soft sky shading from the tight offset shadow introduced in v12.

Each self-contained `cover-*.svg` has separate artwork, diffuse sky-darkening,
and lettering layers. The shading expands and blurs the title alpha with
zero offset; the lettering itself is unfiltered. Its wide feather blends
across letter gaps and fades into the existing cloud texture.

Upload the three exact-size `cover-*.png` files. The matching `title-*.png`
and SVG files contain only lettering plus diffuse shading on transparency.
`title-alpha-master.png` remains the unshaded lettering asset.

Edit placement in `layouts.json` and the shading filter in `render.mjs`, then
run from the repository root:

```sh
node kingdomofthefairies/design/distribution/crazygames/covers/v13/render.mjs
```

The renderer verifies native alpha. `provenance.json` records the reference
comparison and exact shadow settings. All earlier versions remain preserved.
