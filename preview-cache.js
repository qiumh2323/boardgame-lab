// Cache DOM previews by their actual visible contents, not by turn number.
export function createPreviewCache(limit=64){
 const slots=new Map();
 return {
  get(slot,signature,build){const found=slots.get(slot);if(found?.signature===signature)return found.value;const value=build();slots.delete(slot);slots.set(slot,{signature,value});if(slots.size>limit)slots.delete(slots.keys().next().value);return value;},
  clear(){slots.clear();}
 };
}
