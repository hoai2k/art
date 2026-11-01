# Fibre Art assets

62 generated images from the requests in `../../design/image-requests.md`:
ten compositions, ten grounds, ten transparent piece sheets, the title and icon,
interface and control drawings, pause and fullscreen badges and threads, six morph chains, eight fabric
swatches, six greyscale dissolve maps and five animation requests. The game loads
optimised copies made from these by `../../tools/build_web.py` into `../web/`;
these full-size files are not published.

The built-in image generator used the local artwork references. Grounds and
piece sheets used their generated composition as the reference. Files were
converted to the requested PNG/WebP formats and dimensions; the requested
dimensions sometimes exceed the generator's native output size. Alpha was
preserved. Dissolve maps are opaque single-channel greyscale, spanning 0–255.

`../../design/image-deliveries.json` records prompts, references, native and
saved dimensions, hashes, and failed requests. `../../design/generated-preview.jpg`
shows the generated images; `../../design/pieces-preview.jpg` shows all 82
extracted tableau pieces. Ten new tree and bird morph stages are also extracted. The extracted paths, names and sheet coordinates
are in `pieces.json`, in request order. Rebuild those cuts with
`python3 fibreart/tools/extract_pieces.py` (Pillow, NumPy, SciPy); review the
component selections whenever a sheet changes. These are approximate generated
matches to the composition, not pixel-identical layers for reconstruction.

Fabric swatches have the requested appearance, but repeat-edge continuity is
approximate; seams can remain visible, especially in lace and paisley. Check
them with the intended wrapping/sampling before using them as large fills.

All requests are delivered. The six previously rejected requests were retried
successfully; their earlier failures remain in the delivery records. Generated
blink and wing replacements approximately match the original sprites, but are
not pixel-identical outside the edited area. Review their transitions in play.
