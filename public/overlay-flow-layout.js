// Keep the established seven-map composition; larger pools use rows within 1080p.
function layoutVetoFlow(container,state){
  const count=state.mapPool?.length||state.maps.length,rows=Math.ceil(count/7);
  if(rows<=1){container.style.removeProperty('display');container.style.removeProperty('grid-template-columns');container.style.removeProperty('grid-template-rows');container.style.removeProperty('height');container.style.removeProperty('margin-top');return}
  const height=Math.min(840,rows*350);
  container.style.display='grid';container.style.gridTemplateColumns='repeat(7,minmax(0,1fr))';
  container.style.gridTemplateRows=`repeat(${rows},minmax(0,1fr))`;
  container.style.height=`${height}px`;container.style.marginTop=`${1020-height}px`;
}
