// Explicit rockfall particle emitters: repeatable from each stone's phase,
// with individual grains and fading dust rather than hazard-marker circles.
const fraction = n => n - Math.floor(n);
const noise = n => fraction(Math.sin(n*127.1+311.7)*43758.5453);
export function rockfallDust(k, x, top, time, intensity = 1, seed = x) {
  const c = k.c;
  c.save();
  for (let i=0; i<65; i++) {
    const life = fraction(time*(.45+noise(i+seed)*.7)+noise(i*9+seed));
    const drift = (noise(i*3+seed)-.5)*(18+life*75);
    const y = top + life*life*(75+intensity*380);
    c.globalAlpha = Math.sin(life*Math.PI)*(.18+noise(i*4)*.4)*intensity;
    c.fillStyle = k.col(i%3 ? '#ad957b' : '#ded1b5');
    c.save();c.translate(x+drift,y);c.rotate(life*(i%2?4:-3));
    const size = .7+noise(i*5+seed)*2.1;
    c.fillRect(-size/2,-size/2,size,size*(1+noise(i)));
    c.restore();
  }
  // Soft, expanding dust particles are emitted unevenly at the source.
  for (let i=0; i<16; i++) {
    const age = fraction(time*.6+noise(i+seed));
    const dx = (noise(i*7+seed)-.5)*(20+age*90), dy=age*45;
    const radius=3+age*14, opacity=(1-age)*.12*intensity;
    const g=c.createRadialGradient(x+dx,top+dy,0,x+dx,top+dy,radius);
    g.addColorStop(0,`rgba(206,185,157,${opacity})`);g.addColorStop(1,'rgba(206,185,157,0)');
    c.globalAlpha=1;c.fillStyle=g;c.fillRect(x+dx-radius,top+dy-radius,radius*2,radius*2);
  }
  c.restore();
}
export function rockfallTrail(k, rock, time) {
  rockfallDust(k,rock.x,-rock.y-28,time,.65,rock.spin*100);
}
