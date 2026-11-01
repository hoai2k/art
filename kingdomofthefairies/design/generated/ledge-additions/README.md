# C16–C17 image additions — 8 October 2026

Three sprites generated with built-in imagegen: clam-open-empty, sailor-hang
and sailor-pullup. The clam uses its delivered open-shell sprite as the edit
target. Sailor refinements use standing and leaping sprites as identity and
painted-style references. See [the gallery](index.html), [complete prompts](prompts.json)
and [anchor review](review.jpg).

Originals and earlier takes are retained in originals/ and rejected/.
References are lossless PNG conversions of the delivered WebP art. PNGs are
retained in intake; quality-94 alpha WebP copies are registered as delivered
in assets. Existing Act II and IV drawing hooks use them without code changes.

The clam retains its canvas proportions and floor baseline. The hanging pose
is sized proportionally, with its hands at the top centre. The pull-up pose
is sized proportionally and padded so its measured palm/knee contact row
lands at y=225 of the 300-pixel canvas, with the full dangling boot visible.
Forearm/knee variation is about two output pixels. Exact crops, placement
and source/target anchors are recorded in the prompt manifest.

prepare_delivery.py reproduces sizing from the saved originals into delivery/.
No ledge, wall or guide is painted into either sailor image. The red contact
line appears only on the JPEG review sheet. Remote publication requires
separate authorization.
