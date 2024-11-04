class SvgConverter{constructor(t){this.jsPDF=t,this.maxFileSize=15728640}async convertToPdf(t){try{if(!this.isValidSvgFile(t))throw new Error("Ungültige SVG-Datei oder Dateigröße überschritten");const e=await t.text(),i=await this.loadSvgAsImage(e),s=i.width/i.height,n=this.determineOrientation(s),a=new this.jsPDF({orientation:n,unit:"mm",format:"a4"}),h=a.internal.pageSize.getWidth(),r=a.internal.pageSize.getHeight(),o=this.calculateDimensions(i.width,i.height,h,r),d=(h-o.width)/2,g=(r-o.height)/2;return a.addImage(i.src,"PNG",d,g,o.width,o.height),a}catch(t){throw new Error(`SVG-Konvertierungsfehler: ${t.message}`)}}determineOrientation(t){return t>1.2?"landscape":t<.8?"portrait":"portrait"}isValidSvgFile(t){return("image/svg+xml"===t.type||t.name.toLowerCase().endsWith(".svg"))&&t.size<=this.maxFileSize}loadSvgAsImage(t){return new Promise((e,i)=>{const s=new Blob([t],{type:"image/svg+xml"}),n=URL.createObjectURL(s),a=new Image;a.onload=()=>{const t=document.createElement("canvas"),i=t.getContext("2d");t.width=a.width||1e3,t.height=a.height||1e3,i.fillStyle="#FFFFFF",i.fillRect(0,0,t.width,t.height),i.drawImage(a,0,0,t.width,t.height);const s=new Image;s.src=t.toDataURL("image/png"),s.width=t.width,s.height=t.height,URL.revokeObjectURL(n),e(s)},a.onerror=()=>{URL.revokeObjectURL(n),i(new Error("SVG konnte nicht geladen werden"))},a.src=n})}calculateDimensions(t,e,i,s){const n=i-20,a=s-20;let h=t,r=e;const o=Math.min(n/t,a/e);return h*=o,r*=o,{width:h,height:r}}}export{SvgConverter};