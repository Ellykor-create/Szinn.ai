/* SZINN motion: reveal on scroll with stagger, soft parallax on hero and dark bands. No dependencies. */
(function(){
  var d=document.documentElement; d.classList.add('js');
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var groups=['.cards5','.lens-grid','.steprow','.feat','.ins-grid','.team','.faq-cols > div','.mini','.checks','.prompts','.rel-grid','.igrid','.fnav','.trio','.bubbles','.exp','.links','.toc ol'];
  var singles=['section h2','section .kicker','section .lead','section .pre','section p.faq-more','.signature p','.signature .checks','.signature .cta','.signature .assure','.signature blockquote','.what blockquote','#definition p','.daily .price','.daily .btn','.phone','.companion-card','.companion .side','.rhythm h3','.free .lp','.founders .lead','.closing h2','.closing .btn','.num','.pull','.ahead h1','.ahead .intro','.ahead .kicker','.ahead .crumbs','.ehero h1','.ehero .sub','.ebody .row > div','.eclose blockquote','.ecta h2','.ecta p','.ecta .btn','.fbody h2','.fbody .kicker','.fbody p','.fquote','.fside > div','.fhero .txt > *','.about-intro > .wrap > *','.method .wrap > div','.ilist h1','.ilist .lead','.rev-head > *','.marquee','.rev-note'];
  var imgs=['.ahead .img','.side-img','.ebody .fig','.icard img','.ins img','.rel img','.fhero .pic'];
  function mark(sel,cls,stagger){
    document.querySelectorAll(sel).forEach(function(el){
      if(stagger){Array.prototype.forEach.call(el.children,function(c,i){if(!c.classList.contains('rv')){c.classList.add('rv');c.style.setProperty('--d',Math.min(i*70,560)+'ms');}});}
      else if(!el.classList.contains(cls)&&!el.closest('.hero')) el.classList.add(cls);
    });
  }
  groups.forEach(function(s){mark(s,'rv',true)});
  singles.forEach(function(s){mark(s,'rv',false)});
  imgs.forEach(function(s){mark(s,'rv-img',false)});
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{rootMargin:'0px 0px -8% 0px',threshold:0.08});
  document.querySelectorAll('.rv,.rv-img').forEach(function(el){
    var r=el.getBoundingClientRect(); if(r.top<window.innerHeight*0.9){el.classList.add('in');} else io.observe(el);
  });
  /* soft parallax on background sections */
  var px=Array.prototype.slice.call(document.querySelectorAll('.what,.signature,.closing,.ehero'));
  if(px.length&&window.innerWidth>860){
    px.forEach(function(el){el.classList.add('parallax')});
    var ticking=false;
    function upd(){ticking=false;var h=window.innerHeight;px.forEach(function(el){var r=el.getBoundingClientRect();if(r.bottom<0||r.top>h)return;var p=(r.top+r.height/2-h/2)/h;el.style.backgroundPositionY='calc(50% + '+(p*40).toFixed(1)+'px)';});}
    window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(upd);}},{passive:true}); upd();
  }
})();
