// Foreground pieces of the delivered wedding set, in its 1280 x 720 stage
// coordinates. Repaint these exact pixels over the stair walkers. Openings
// between the balusters stay transparent so legs can show through them.
export function weddingForeground(k) {
  const c = k.c;
  const polygon = points => {
    c.moveTo(...points[0]);
    for (const point of points.slice(1)) c.lineTo(...point);
    c.closePath();
  };
  c.save(); c.beginPath();
  polygon([[926,491],[1280,345],[1280,363],[929,508]]); // sloping handrail
  polygon([[912,586],[1280,434],[1280,615],[912,615]]); // stone base
  polygon([[900,477],[929,475],[938,610],[906,612]]); // lower newel
  polygon([[1034,391],[1073,390],[1083,609],[1037,608]]); // upper newel
  for (const x of [953,979,1004,1029]) {
    const top=493-(x-930)*.405, bottom=589-(x-930)*.405;
    polygon([[x-5,top],[x+6,top-4],[x+7,bottom],[x-6,bottom+4]]);
  }
  // The garlands and hanging pennants are solid foreground fabric/flowers.
  for (const [x,y,rx,ry] of [[946,549,17,55],[993,526,19,64],[1055,485,24,94],[1070,382,38,39]]) {
    c.moveTo(x+rx,y); c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  }
  polygon([[1090,429],[1124,414],[1124,559],[1107,546],[1094,573]]);
  polygon([[1122,414],[1183,390],[1183,553],[1151,537],[1123,574]]);
  polygon([[1180,391],[1230,371],[1230,557],[1204,541],[1182,569]]);
  polygon([[1228,371],[1280,348],[1280,549],[1254,533],[1230,557]]);
  // Door jambs remain in front while the couple crosses the dark opening.
  polygon([[1105,193],[1132,182],[1138,416],[1104,433]]);
  polygon([[1240,173],[1280,162],[1280,424],[1239,411]]);
  c.clip(); k.asset('wedding-street',640,720,1280,720); c.restore();
}
