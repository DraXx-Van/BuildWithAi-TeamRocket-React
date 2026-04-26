import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useIncidentStore from '../../store/useIncidentStore';
import { severityColor } from '../../models/incident';

const LW = 1000, LH = 562;
const MIN_Z = 0.25, MAX_Z = 6;

function hexRgba(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.length===3?h[0]+h[0]:h.slice(0,2),16);
  const g = parseInt(h.length===3?h[1]+h[1]:h.slice(2,4),16);
  const b = parseInt(h.length===3?h[2]+h[2]:h.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

function rrect(ctx,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);     ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function getRoomColor(type){
  const m={room:'#64748b',suite:'#64748b',lobby:'#64748b',corridor:'#475569',
    stair:'#3b82f6',exit:'#10b981',elevator:'#f59e0b',restaurant:'#64748b',
    kitchen:'#64748b',utility:'#475569',pool:'#0ea5e9',gym:'#64748b',
    bar:'#64748b',conference:'#64748b',garden:'#10b981',shop:'#64748b',
    lounge:'#64748b',other:'#64748b'};
  return m[(type||'').toLowerCase()]||'#64748b';
}

function matchRoom(room,inc){
  if (!room.name || !inc) return false;
  const loc=(inc.location||'').toLowerCase(), desc=(inc.description||'').toLowerCase();
  const name=(room.name||'').toLowerCase(), type=(room.type||'').toLowerCase();
  
  if (name.length < 3) return false;

  // 1. Direct location match
  if(loc === name || loc.includes(name) || name.includes(loc)) return true;
  
  // 2. Strict phrase matching from description
  const parts=name.split(/[/,]/).map(p=>p.trim()).filter(Boolean);
  if(parts.some(p=>p.length >= 4 && (loc.includes(p) || desc.includes(p)))) return true;
  
  // 3. Type matching only for highly specific structural zones (not generic "room")
  if(type === 'exit' || type === 'stair' || type === 'elevator') {
    if(loc.includes(type) || desc.includes(type)) return true;
  }
  
  return false;
}

// ── Draw popup panel directly on canvas ──────────────────────────────────────
function drawPopup(ctx, room, inc, phase) {
  const col = severityColor(inc.severity);
  const rx=room.xPercent*LW, ry=room.yPercent*LH;
  const rw=(room.widthPercent||0.08)*LW, rh=(room.heightPercent||0.12)*LH;

  // Layout constants — each section has an explicit Y anchor
  const PW=224, PAD=14;

  // ── Measure description lines first so we know total height ──
  ctx.save();
  ctx.font='400 9px Inter,sans-serif';
  const maxTxtW = PW - PAD*2;
  const rawDesc = (inc.description||'No details available.').slice(0,120);
  const descWords = rawDesc.split(' ');
  let dLine='', dLines=[];
  for(const w of descWords){
    const test=dLine?dLine+' '+w:w;
    if(ctx.measureText(test).width>maxTxtW&&dLine){dLines.push(dLine);dLine=w;}
    else dLine=test;
  }
  dLines.push(dLine);
  dLines=dLines.slice(0,3); // max 3 lines
  const descH = dLines.length*13;

  // Y anchors (all relative to panel top py)
  const Y_HEADER   = PAD;            // "● LIVE INTEL" + ✕
  const Y_TYPE     = Y_HEADER+20;    // "FIRE" big title
  const Y_SUBTITLE = Y_TYPE+18;      // "KITCHEN · SEV 7/10"
  const Y_TILES    = Y_SUBTITLE+16;  // stat tiles row
  const TILE_H     = 34;
  const Y_DESC     = Y_TILES+TILE_H+10;  // description block
  const Y_BTN      = Y_DESC+descH+10;    // deploy button (10px gap after desc)
  const BTN_H      = 22;
  const PH         = Y_BTN+BTN_H+PAD;   // total panel height

  // Position panel above room, clamp to canvas
  let px = rx + rw/2 - PW/2;
  let py = ry - PH - 14;
  px = Math.max(4, Math.min(LW-PW-4, px));
  py = Math.max(4, py);

  // Panel shadow
  ctx.shadowColor='rgba(0,0,0,0.85)'; ctx.shadowBlur=32; ctx.shadowOffsetY=10;
  ctx.fillStyle='rgba(7,7,12,0.98)';
  rrect(ctx,px,py,PW,PH,10); ctx.fill();
  ctx.shadowBlur=0; ctx.shadowOffsetY=0;

  // Panel border glow
  ctx.strokeStyle=col; ctx.lineWidth=1.5;
  ctx.shadowColor=col; ctx.shadowBlur=14;
  rrect(ctx,px,py,PW,PH,10); ctx.stroke();
  ctx.shadowBlur=0;

  // Connector dashed line
  const connX=rx+rw/2;
  ctx.strokeStyle=hexRgba(col,0.35); ctx.lineWidth=1; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(connX,py+PH); ctx.lineTo(connX,ry); ctx.stroke();
  ctx.setLineDash([]);

  // ── Header: ● LIVE INTEL ✕ ──
  const pulse=0.55+0.45*Math.sin(phase*2.2);
  ctx.fillStyle=hexRgba(col,pulse);
  ctx.beginPath(); ctx.arc(px+PAD+4,py+Y_HEADER+5,3.5,0,Math.PI*2); ctx.fill();

  ctx.fillStyle=col; ctx.font='700 8px monospace';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('LIVE INTEL', px+PAD+12, py+Y_HEADER);

  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='700 11px sans-serif';
  ctx.textAlign='right'; ctx.textBaseline='top';
  ctx.fillText('✕', px+PW-PAD, py+Y_HEADER-1);

  // Divider
  ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(px+PAD,py+Y_HEADER+14); ctx.lineTo(px+PW-PAD,py+Y_HEADER+14); ctx.stroke();

  // ── Incident type title ──
  ctx.fillStyle='#ffffff'; ctx.font='800 14px Inter,sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.shadowColor=col; ctx.shadowBlur=8;
  const typeLabel=(inc.hazard||inc.type||'INCIDENT').toUpperCase();
  ctx.fillText(typeLabel, px+PAD, py+Y_TYPE, PW-PAD*2);
  ctx.shadowBlur=0;

  // ── Subtitle: room · severity ──
  ctx.fillStyle='rgba(255,255,255,0.38)'; ctx.font='500 9px Inter,sans-serif';
  ctx.fillText(`${room.name.toUpperCase()} · SEV ${inc.severity}/10`, px+PAD, py+Y_SUBTITLE, PW-PAD*2);

  // ── Stat tiles ──
  const tw=(PW-PAD*3)/2;
  const tiles=[
    {label:'SEVERITY', value:`LVL ${inc.severity}`, color:col},
    {label:'STATUS',   value:(inc.status||'ACTIVE').toUpperCase(), color:'#10b981'},
  ];
  tiles.forEach((t,i)=>{
    const tx=px+PAD+i*(tw+PAD), ty=py+Y_TILES;
    ctx.fillStyle='rgba(255,255,255,0.04)';
    rrect(ctx,tx,ty,tw,TILE_H,6); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1;
    rrect(ctx,tx,ty,tw,TILE_H,6); ctx.stroke();
    // Label
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='600 7px monospace';
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(t.label, tx+7, ty+6);
    // Value
    ctx.fillStyle=t.color; ctx.font='700 12px Inter,sans-serif';
    ctx.fillText(t.value, tx+7, ty+17);
  });

  // ── Description ──
  ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.font='400 9px Inter,sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='top';
  dLines.forEach((l,i)=>ctx.fillText(l, px+PAD, py+Y_DESC+i*13, maxTxtW));

  // ── Deploy / Details button ──
  const isDispatched = inc.status === 'dispatched';
  const btnX=px+PAD, btnY=py+Y_BTN, btnW=PW-PAD*2;
  const btnColor = isDispatched ? 'rgba(255,255,255,0.06)' : col;
  const btnTextCol = isDispatched ? 'rgba(255,255,255,0.6)' : '#fff';
  const btnLabel = isDispatched ? 'OPEN DETAILS' : 'DEPLOY ASSETS';

  ctx.fillStyle=btnColor; ctx.shadowColor=col; ctx.shadowBlur=isDispatched ? 0 : 10;
  rrect(ctx,btnX,btnY,btnW,BTN_H,6); ctx.fill();
  if (isDispatched) {
    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1;
    rrect(ctx,btnX,btnY,btnW,BTN_H,6); ctx.stroke();
  }
  ctx.shadowBlur=0;
  ctx.fillStyle=btnTextCol; ctx.font='700 8px monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(btnLabel, px+PW/2, btnY+BTN_H/2);

  ctx.restore();

  return {
    closeX:{ x:px+PW-PAD-10, y:py+Y_HEADER-2, w:16, h:16 },
    deploy:{ x:btnX, y:btnY, w:btnW, h:BTN_H },
  };
}


export default function FloorPlanCanvas({ fullBleed=false }) {
  const navigate = useNavigate();
  const { floorData,currentFloor,floors,setCurrentFloor,
          liveIncidents,setDispatchResult,confirmDispatch, setFocusedIncidentId, setSelectedIncidentId } = useIncidentStore();

  const canvasRef = useRef(null);
  const wrapRef   = useRef(null);
  const stateRef  = useRef({ zoom:1,pan:{x:0,y:0},rooms:[],incs:[],selected:null });
  const dragRef   = useRef(null);
  // Store popup hit-areas so click handler can test them
  const popupHitRef = useRef(null);

  const [zoom,setZoom]     = useState(1);
  const [pan,setPan]       = useState({x:0,y:0});
  const [dragging,setDragging] = useState(false);
  const [selected,setSelected] = useState(null); // { room, inc }

  const rooms = floorData[currentFloor]?.rooms || [];

  stateRef.current.zoom=zoom; stateRef.current.pan=pan;
  stateRef.current.rooms=rooms; stateRef.current.incs=liveIncidents;
  stateRef.current.selected=selected;

  // ── sToL: screen → logical ────────────────────────────────────────────────
  const sToL = useCallback((sx,sy)=>{
    const c=canvasRef.current; if(!c) return{x:0,y:0};
    const dpr=window.devicePixelRatio||1;
    const W=c.width/dpr,H=c.height/dpr;
    const {zoom:z,pan:p}=stateRef.current;
    return{x:(sx-W/2-p.x)/z+LW/2, y:(sy-H/2-p.y)/z+LH/2};
  },[]);

  // ── Draw ─────────────────────────────────────────────────────────────────
  const draw = useCallback((ts)=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const dpr=window.devicePixelRatio||1;
    const W=canvas.width/dpr, H=canvas.height/dpr;
    const ctx=canvas.getContext('2d');
    const {zoom:z,pan:p,rooms,incs,selected}=stateRef.current;
    const phase=ts/1000;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save(); ctx.scale(dpr,dpr);

    // BG
    ctx.fillStyle='#08080c'; ctx.fillRect(0,0,W,H);

    // World transform
    ctx.save();
    ctx.translate(W/2+p.x, H/2+p.y);
    ctx.scale(z,z);
    ctx.translate(-LW/2,-LH/2);

    // Grid dots
    ctx.fillStyle='rgba(161,161,170,0.06)';
    for(let gx=0;gx<=LW;gx+=25) for(let gy=0;gy<=LH;gy+=25){
      ctx.beginPath(); ctx.arc(gx,gy,0.7,0,Math.PI*2); ctx.fill();
    }

    // ── Rooms ──
    rooms.forEach(room=>{
      const inc=incs.find(i=>matchRoom(room,i) && i.status !== 'resolved');
      const isAlert=Boolean(inc);
      const col=isAlert?severityColor(inc.severity):getRoomColor(room.type);
      const rx=room.xPercent*LW, ry=room.yPercent*LH;
      const rw=(room.widthPercent||0.08)*LW, rh=(room.heightPercent||0.12)*LH;

      // Alert shadow glow
      if(isAlert){
        const p2=0.5+0.5*Math.sin(phase*(inc.severity>=8?3.5:1.8));
        ctx.shadowColor=col; ctx.shadowBlur=10+8*p2;
      }

      // Fill
      if(isAlert){
        const fg=ctx.createRadialGradient(rx+rw/2,ry+rh/2,0,rx+rw/2,ry+rh/2,Math.max(rw,rh));
        fg.addColorStop(0,hexRgba(col,0.22)); fg.addColorStop(1,hexRgba(col,0.05));
        ctx.fillStyle=fg;
      } else { ctx.fillStyle=hexRgba(col,0.06); }
      rrect(ctx,rx,ry,rw,rh,5); ctx.fill();

      // Border
      ctx.shadowBlur=isAlert?6:0; ctx.shadowColor=col;
      ctx.strokeStyle=isAlert?col:hexRgba(col,0.2);
      ctx.lineWidth=isAlert?2:1;
      rrect(ctx,rx,ry,rw,rh,5); ctx.stroke();
      ctx.shadowBlur=0;

      // Name
      ctx.fillStyle=isAlert?'#fff':hexRgba(col,0.8);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      if(isAlert){ctx.shadowColor=col;ctx.shadowBlur=6;}
      const nm=room.name||'';
      const nameParts=nm.split(/\s*\/\s*/);
      if(nameParts.length>1&&rw<130){
        ctx.font=`700 8.5px Inter,sans-serif`;
        ctx.fillText(nameParts[0],rx+rw/2,ry+rh/2-8,rw-6);
        ctx.font=`600 7px Inter,sans-serif`;
        ctx.fillStyle=isAlert?hexRgba(col,0.85):hexRgba(col,0.55);
        ctx.fillText(nameParts.slice(1).join(' / '),rx+rw/2,ry+rh/2+4,rw-6);
      } else {
        ctx.font=`700 9px Inter,sans-serif`;
        ctx.fillText(nm,rx+rw/2,ry+rh/2-5,rw-6);
      }
      ctx.shadowBlur=0;

      // Type label
      ctx.font=`700 6px monospace`;
      ctx.fillStyle=isAlert?hexRgba(col,0.9):hexRgba(col,0.4);
      ctx.fillText((isAlert?(inc.type||'incident'):room.type||'room').toUpperCase(),
        rx+rw/2,ry+rh-(nameParts.length>1?10:11),rw-4);

      // Responder Location Tag
      if(isAlert && inc.assignedTo){
        ctx.fillStyle='#10b981'; // Green success color
        ctx.font='700 8px monospace';
        ctx.fillText(`🛡️ ${inc.assignedTo.split(' ')[0].toUpperCase()}`, rx+rw/2, ry+rh/2+14);
      }

      // Alert badge pill
      if(isAlert){
        const bw = 32;
        const bh=14,bx=rx+rw-1,by=ry+1;
        ctx.fillStyle=col; ctx.shadowColor=col; ctx.shadowBlur=isAlert ? 10 : 0;
        rrect(ctx,bx-bw,by-bh,bw,bh,4); ctx.fill(); ctx.shadowBlur=0;
        
        // Dot
        ctx.fillStyle='rgba(255,255,255,0.85)';
        const p3=0.5+0.5*Math.sin(phase*4);
        ctx.beginPath(); ctx.arc(bx-bw+6,by-bh/2,1.5+1*p3,0,Math.PI*2); ctx.fill();

        ctx.fillStyle='#fff'; ctx.font='700 6px monospace'; ctx.textAlign='center';
        ctx.fillText(`LVL ${inc.severity||1}`,bx-bw/2+3,by-bh/2+0.5);
      }
    });

    // ── Popup panel — drawn above the selected room ──
    if(selected){
      popupHitRef.current = drawPopup(ctx, selected.room, selected.inc, phase);
    } else {
      popupHitRef.current = null;
    }

    ctx.restore(); // world
    ctx.restore(); // dpr
  },[]);

  // ── RAF loop ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    let id;
    const loop=(ts)=>{ draw(ts); id=requestAnimationFrame(loop); };
    id=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(id);
  },[draw]);

  // ── Resize ───────────────────────────────────────────────────────────────
  useEffect(()=>{
    const c=canvasRef.current; if(!c) return;
    const dpr=window.devicePixelRatio||1;
    const ro=new ResizeObserver(([e])=>{
      const {width,height}=e.contentRect;
      c.width=width*dpr; c.height=height*dpr;
    });
    ro.observe(c);
    const {width,height}=c.getBoundingClientRect();
    c.width=width*dpr; c.height=height*dpr;
    return ()=>ro.disconnect();
  },[]);

  // ── Wheel zoom (non-passive) ──────────────────────────────────────────────
  useEffect(()=>{
    const el=wrapRef.current; if(!el) return;
    const fn=(e)=>{
      e.preventDefault();
      const rect=el.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top;
      const delta=-e.deltaY*0.001;
      setZoom(pz=>{
        const nz=Math.min(MAX_Z,Math.max(MIN_Z,pz+delta*pz));
        const ratio=nz/pz;
        const W=el.clientWidth,H=el.clientHeight;
        setPan(pp=>({x:mx-W/2-ratio*(mx-W/2-pp.x),y:my-H/2-ratio*(my-H/2-pp.y)}));
        return nz;
      });
    };
    el.addEventListener('wheel',fn,{passive:false});
    return ()=>el.removeEventListener('wheel',fn);
  },[]);

  // ── Auto-fit ─────────────────────────────────────────────────────────────
  const fitToRooms=useCallback((roomList)=>{
    const el=wrapRef.current;
    if(!el||!roomList?.length) return;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    roomList.forEach(r=>{
      const rx=r.xPercent*LW,ry=r.yPercent*LH;
      const rw=(r.widthPercent||0.08)*LW,rh=(r.heightPercent||0.12)*LH;
      minX=Math.min(minX,rx);minY=Math.min(minY,ry);
      maxX=Math.max(maxX,rx+rw);maxY=Math.max(maxY,ry+rh);
    });
    const pad=60;
    const bw=maxX-minX+pad*2,bh=maxY-minY+pad*2;
    const W=el.clientWidth,H=el.clientHeight;
    const fz=Math.min(MAX_Z,Math.max(MIN_Z,Math.min(W/bw,H/bh)));
    const cx=(minX+maxX)/2-LW/2, cy=(minY+maxY)/2-LH/2;
    setZoom(fz); setPan({x:-cx*fz,y:-cy*fz});
  },[]);

  useEffect(()=>{ fitToRooms(rooms); },[rooms.length,currentFloor]);

  // ── Pan ──────────────────────────────────────────────────────────────────
  const onMouseDown=(e)=>{
    if(e.button!==0) return;
    dragRef.current={sx:e.clientX,sy:e.clientY,px:pan.x,py:pan.y,moved:false};
    setDragging(true);
  };
  const onMouseMove=(e)=>{
    if(!dragRef.current) return;
    const dx=e.clientX-dragRef.current.sx,dy=e.clientY-dragRef.current.sy;
    if(Math.abs(dx)+Math.abs(dy)>3) dragRef.current.moved=true;
    if(dragRef.current.moved) setPan({x:dragRef.current.px+dx,y:dragRef.current.py+dy});
  };
  const onMouseUp=()=>setDragging(false);

  // ── Click: hit-test rooms + popup buttons ─────────────────────────────────
  const onClick=(e)=>{
    if(dragRef.current?.moved){ dragRef.current=null; return; }
    dragRef.current=null;
    const c=canvasRef.current; if(!c) return;
    const rect=c.getBoundingClientRect();
    const {x:lx,y:ly}=sToL(e.clientX-rect.left, e.clientY-rect.top);

    // Check popup buttons first (they're in logical space)
    const hit=popupHitRef.current;
    if(hit && selected){
      // Close X
      if(lx>=hit.closeX.x&&lx<=hit.closeX.x+hit.closeX.w&&ly>=hit.closeX.y&&ly<=hit.closeX.y+hit.closeX.h){
        setSelected(null); return;
      }
      // Deploy / Open Details
      if(lx>=hit.deploy.x&&lx<=hit.deploy.x+hit.deploy.w&&ly>=hit.deploy.y&&ly<=hit.deploy.y+hit.deploy.h){
        if (selected.inc?.status === 'dispatched') {
          // Navigate to details
          setFocusedIncidentId(selected.inc.id);
          setSelectedIncidentId(selected.inc.id);
          navigate('/command/incidents');
        } else if (selected.inc?.dispatchSuggestion) {
          // Trigger dispatch
          setDispatchResult(selected.inc.dispatchSuggestion, selected.inc.id);
          confirmDispatch();
        }
        setSelected(null); return;
      }
    }

    // Room hit-test
    const room=rooms.find(r=>{
      const rx=r.xPercent*LW,ry=r.yPercent*LH;
      const rw=(r.widthPercent||0.08)*LW,rh=(r.heightPercent||0.12)*LH;
      return lx>=rx&&lx<=rx+rw&&ly>=ry&&ly<=ry+rh;
    });
    if(!room){ setSelected(null); return; }
    const inc=liveIncidents.find(i=>matchRoom(room,i) && i.status !== 'resolved');
    if(!inc){ setSelected(null); return; }
    setSelected(prev=>prev?.room?.id===room.id?null:{room,inc});
  };

  // Zoom controls
  const zoomBy=(f)=>{
    const el=wrapRef.current; if(!el) return;
    const W=el.clientWidth,H=el.clientHeight;
    setZoom(pz=>{ const nz=Math.min(MAX_Z,Math.max(MIN_Z,pz*f)); const r=nz/pz;
      setPan(pp=>({x:W/2-r*(W/2-pp.x),y:H/2-r*(H/2-pp.y)})); return nz; });
  };
  const reset=()=>{ fitToRooms(rooms); setSelected(null); };

  return (
    <div style={{position:'relative',width:'100%',height:'100%',display:'flex',flexDirection:'column',
      background:'var(--color-bg)',borderRadius:fullBleed?0:'var(--radius-lg)',overflow:'hidden'}}>

      {/* Floor selector */}
      {floors.length>0&&(
        <div style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',zIndex:1200,
          display:'flex',flexDirection:'column',gap:6,background:'rgba(12,12,16,0.92)',padding:'8px 6px',
          borderRadius:14,border:'1px solid rgba(255,255,255,0.07)',backdropFilter:'blur(20px)'}}>
          {floors.map(f=>(
            <button key={f} onClick={()=>{setCurrentFloor(f);reset();}}
              style={{width:32,height:32,borderRadius:7,cursor:'pointer',fontSize:10,fontWeight:800,
                border:currentFloor===f?'2px solid var(--color-primary)':'1px solid #3f3f46',
                background:currentFloor===f?'rgba(139,92,246,0.2)':'transparent',
                color:currentFloor===f?'white':'#71717a'}}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Zoom controls */}
      <div style={{position:'absolute',right:10,top:10,zIndex:1200,display:'flex',flexDirection:'column',gap:3,
        background:'rgba(12,12,16,0.92)',padding:5,borderRadius:10,
        border:'1px solid rgba(255,255,255,0.07)',backdropFilter:'blur(20px)'}}>
        {[{l:'+',f:()=>zoomBy(1.3)},{l:'−',f:()=>zoomBy(1/1.3)},{l:'⊞',f:reset}].map(({l,f})=>(
          <button key={l} onClick={f}
            style={{width:28,height:28,borderRadius:6,border:'1px solid rgba(255,255,255,0.07)',
              background:'rgba(255,255,255,0.03)',color:'rgba(255,255,255,0.7)',
              fontSize:l==='⊞'?13:17,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(139,92,246,0.2)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
          >{l}</button>
        ))}
        <div style={{textAlign:'center',fontSize:7,fontFamily:'monospace',color:'rgba(255,255,255,0.25)',paddingTop:1}}>
          {Math.round(zoom*100)}%
        </div>
      </div>

      {/* Canvas viewport */}
      <div ref={wrapRef} style={{flex:1,position:'relative',overflow:'hidden',cursor:dragging?'grabbing':'grab'}}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onClick={onClick}>
        <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}} />
        <div style={{position:'absolute',bottom:6,left:48,fontFamily:'monospace',fontSize:7,
          color:'rgba(255,255,255,0.15)',letterSpacing:0.8,pointerEvents:'none'}}>
          FLOOR {(currentFloor||'?').toUpperCase()} · {Math.round(zoom*100)}% · SCROLL=ZOOM · DRAG=PAN
        </div>
      </div>
    </div>
  );
}
