'use strict';
(()=>{
	// Jumlah bintang mencakup dua ubin.
	const MOBILE_WIDTH=600;
	const STAR_COUNTS={ desktop: [48, 44, 28], mobile: [20, 18, 12] };
	const STAR_SPEEDS=[0.04, 0.10, 0.20], STAR_SIZES=[1, 2, 3];
	const TWINKLE_SECONDS=[3, 6];
	const TWINKLE_CHANCE=0.42, SPARK_CHANCE=0.07;
	const POINTER_MAX=12, POINTER_LERP=0.08, POINTER_EPSILON=0.05;
	const POINTER_DEPTH=[0.25, 0.55, 1];
	const TILE_BLEED=24, PLANET_BUFFER=320;
	const PLANETS=[
		{ name: 'mustard', top: 0.14, speed: 0.12 },
		{ name: 'pink', top: 0.70, speed: 0.22 },
		{ name: 'teal', top: 0.40, speed: 0.35 },
		{ name: 'purple', top: 0.86, speed: 0.18 },
		{ name: 'moon-body', top: 0.58, speed: 0.16 },
		{ name: 'satellite', top: 0.06, speed: 0.24 }
	];
	const METEOR_LIMIT={ desktop: 2, mobile: 1 };
	const METEOR_INTERVAL=[3000, 7000], METEOR_DURATION=[1200, 2000], METEOR_LENGTH=[120, 180];
	const METEOR_BURST_CHANCE=0.18;
	const THEME_EVENT='arena:themechange', NIGHT_THEME='night';
	const root=document.documentElement;
	const bg=document.querySelector('.space-bg');
	if (!bg) return;
	const stars=[...bg.querySelectorAll('.space-stars')];
	const planets=PLANETS.map(p=>({ ...p, el: bg.querySelector(`.space-${p.name}`) }));
	const reduced=matchMedia('(prefers-reduced-motion: reduce)');
	const fine=matchMedia('(hover: hover) and (pointer: fine)');
	const random=(min, max)=>min+Math.random()*(max-min);
	const modulo=(value, size)=>((value % size)+size) % size;
	let width=innerWidth, height=innerHeight, mobile=width<=MOBILE_WIDTH;
	let scroll=window.scrollY, frame=0, timer=0, listening=false, starsDirty=false;
	let x=0, y=0, targetX=0, targetY=0;
	const nightActive=()=>root.getAttribute('data-theme')===NIGHT_THEME;
	const running=()=>nightActive()&&!document.hidden&&!reduced.matches;
	const pool=Array.from({ length: METEOR_LIMIT.desktop }, ()=>{
		const el=document.createElement('span');
		el.className='space-meteor';
		bg.append(el);
		const slot={ el, busy: false };
		el.addEventListener('animationend', ()=>{
			slot.busy=false;
			el.classList.remove('space-active');
		});
		return slot;
	});
	function buildStars() {
		const counts=STAR_COUNTS[mobile ? 'mobile' : 'desktop'];
		stars.forEach((layer, index)=>{
			const fragment=document.createDocumentFragment();
			for (let i=0; i<counts[index]/2; i++) {
				const left=random(0,100), top=random(0,50);
				const twinkle=Math.random()<TWINKLE_CHANCE;
				const spark=Math.random()<SPARK_CHANCE;
				const duration=random(...TWINKLE_SECONDS), delay=-random(0, TWINKLE_SECONDS[1]);
				for (const offset of [0,50]) {
					const star=document.createElement('span');
					star.className=`space-star${twinkle ? ' space-twinkle' : ''}${spark ? ' space-spark' : ''}`;
					star.style.cssText=`left:${left}%;top:${top+offset}%;--space-size:${STAR_SIZES[index]}px;--space-time:${duration}s;--space-delay:${delay}s`;
					fragment.append(star);
				}
			}
			layer.replaceChildren(fragment);
		});
		bg.classList.add('space-enhanced');
	}
	function requestFrame() {
		if (running()&&!frame) frame=requestAnimationFrame(paint);
	}
	function paint() {
		frame=0;
		if (!running()) return;
		x += (targetX-x)*POINTER_LERP;
		y += (targetY-y)*POINTER_LERP;
		stars.forEach((layer, i)=>{
			const sy=-modulo(scroll*STAR_SPEEDS[i], height+TILE_BLEED);
			layer.style.transform=`translate3d(${x*POINTER_DEPTH[i]}px,${sy+y*POINTER_DEPTH[i]}px,0)`;
		});
		planets.forEach(p=>{
			if (mobile&&['teal','purple','moon-body','satellite'].includes(p.name)) return;
			// Planet berulang di luar layar.
			const base=height*p.top;
			const py=modulo(base-scroll*p.speed+PLANET_BUFFER, height+PLANET_BUFFER*2)-PLANET_BUFFER;
			p.el.style.transform=`translate3d(${x}px,${py-base+y}px,0)`;
		});
		if (Math.abs(targetX-x)>POINTER_EPSILON||Math.abs(targetY-y)>POINTER_EPSILON) requestFrame();
	}
	function queueMeteor() {
		if (!running()) return;
		timer=setTimeout(()=>{
			timer=0;
			if (!running()) return;
			const limit=METEOR_LIMIT[mobile ? 'mobile' : 'desktop'];
			const count=!mobile&&Math.random()<METEOR_BURST_CHANCE ? limit : 1;
			let available=Math.max(0, limit-pool.filter(s=>s.busy).length);
			for (const slot of pool) {
				if (!available||slot.busy) continue;
				if (pool.filter(s=>s.busy).length>=count) break;
				slot.busy=true;
				available -= 1;
				slot.el.style.cssText=`left:${random(45, 110)}%;top:${random(-5, 30)}%;--space-time:${random(...METEOR_DURATION)}ms;--space-length:${random(...METEOR_LENGTH)}px`;
				slot.el.classList.add('space-active');
			}
			queueMeteor();
		}, random(...METEOR_INTERVAL));
	}
	function pointer(event) {
		if (event.pointerType==='touch') return;
		const clamp=n=>Math.max(-POINTER_MAX, Math.min(POINTER_MAX, n));
		targetX=clamp((event.clientX/width-0.5)*POINTER_MAX*2);
		targetY=clamp((event.clientY/height-0.5)*POINTER_MAX*2);
		requestFrame();
	}
	function leave() { targetX=targetY=0; requestFrame(); }
	function sync() {
		cancelAnimationFrame(frame); frame=0;
		if (nightActive()&&starsDirty) { buildStars(); starsDirty=false; }
		clearTimeout(timer); timer=0;
		pool.forEach(slot=>{ slot.busy=false; slot.el.classList.remove('space-active'); });
		const paused=!nightActive()||document.hidden;
		bg.classList.toggle('space-paused', paused);
		document.body.classList.toggle('space-page-paused', paused);
		bg.classList.toggle('space-static', reduced.matches);
		document.body.classList.toggle('space-page-static', reduced.matches);
		const allowPointer=running()&&fine.matches;
		if (allowPointer!==listening) {
			const action=allowPointer ? 'addEventListener' : 'removeEventListener';
			window[action]('pointermove', pointer, { passive: true });
			document[action]('pointerleave', leave);
			listening=allowPointer;
		}
		if (!allowPointer) targetX=targetY=x=y=0;
		if (reduced.matches) {
			[...stars, ...planets.map(p=>p.el)].forEach(el=>{ el.style.transform=''; });
		}
		if (running()) { scroll=window.scrollY; requestFrame(); queueMeteor(); }
	}
	window.addEventListener('scroll', ()=>{
		if (!running()) return;
		scroll=window.scrollY;
		requestFrame();
	}, { passive: true });
	window.addEventListener('resize', ()=>{
		width=innerWidth; height=innerHeight;
		const next=width<=MOBILE_WIDTH;
		if (next!==mobile) {
			mobile=next;
			if (nightActive()) buildStars();
			else starsDirty=true;
		}
		sync();
	}, { passive: true });
	window.addEventListener(THEME_EVENT, sync);
	document.addEventListener('visibilitychange', sync);
	reduced.addEventListener('change', sync);
	fine.addEventListener('change', sync);
	planets.forEach(p=>{ p.el.style.top=`${p.top*100}%`; });
	buildStars();
	document.body.classList.add('space-art-ready');
	sync();
})();
