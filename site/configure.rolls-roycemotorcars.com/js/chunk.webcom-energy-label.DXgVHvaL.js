var p=Object.defineProperty;var s=(e,i)=>p(e,"name",{value:i,configurable:!0});import{aD as r}from"./index.1787754279.js";import{x as f,i as x,n as d,s as b}from"./chunk.query-assigned-elements.CfACBIZI.js";function v(e,i={}){return i[e]||"#000"}s(v,"getColorByEfficiencyClass");function y(e,i){return!e||!i?[]:e.map(c=>({name:c,color:v(c,i)}))}s(y,"prepareClasses");const m=s(e=>f`<div class="efficiency-grid-header"><svg xmlns="http://www.w3.org/2000/svg" viewBox="194.5 896.5 300 300" class="efficiency-grid-flag"><rect x="194.5" y="896.5" fill="#FF0000" width="300" height="300"></rect><rect x="250.75" y="1018.375" fill="#FFFFFF" width="187.5" height="56.25"></rect><rect x="316.375" y="952.75" fill="#FFFFFF" width="56.25" height="187.5"></rect></svg> <span>${e}</span></div>`,"renderHeader"),u=s((e,i)=>e.map(({name:c,color:t},l)=>f`<div class="efficiency-class-holder"><svg height="100%" viewBox="0 0 125 50" class="efficiency-class" style="--class-index: ${l}; fill: ${t}" preserveAspectRatio="xMaxYMid slice"><path d="M -10000 0 h 10100 l 25 25 l -25 25 h -10100 Z" stroke="none"/></svg> <svg class="efficiency-class-text" style="--class-index: ${l};"><text class="text" x="${i}" y="50%">${c[0]}<tspan class="text-sup" dy="-25%">${c.length>1?c.slice(1):""}</tspan></text></svg></div>`),"renderBands$1"),w=s(e=>f`<div id="selectedEfficiency"><svg viewBox="0 0 44 20" preserveAspectRatio="xMinYMid slice" class="selected-efficiency-class"><polygon points="1,10 10,19 43,19 43,1 10,1" stroke="black" stroke-width="2"/></svg> <svg class="selected-efficiency-class-text"><text class="text" x="50%" y="50%">${e[0]}<tspan class="text-sup" dy="-25%">${e.length>1?e.slice(1):""}</tspan></text></svg></div>`,"renderMarker"),z=s((e,i,c,t)=>{const l=y(e,i),n=c?"100%":"5px";return f`${m(c)}<div class="efficiency-grid">${u(l,n)} ${w(t)}</div>`},"renderDefaultLayout"),C=s((e,i)=>{if(i){const c=e.split("<br>");return c.length>1?f`<svg y="0"><text class="efficiency-label-text" x="15px" y="50%"><tspan x="17%" y="42%">${c[0]}</tspan><tspan x="17%" y="75%">${c[1]}</tspan></text></svg>`:f`<svg y="0"><text class="efficiency-label-text" x="15px" y="50%"><tspan x="17%" y="60%">${e}</tspan></text></svg>`}return""},"renderLabel"),$=s((e,i,c)=>e.map(({name:t,color:l},n)=>{const h=i===t,g=C(c,h);return f`<div class="efficiency-class-holder ${h?"efficiency-class-holder--selected":""}"><svg height="100%" viewBox="0 0 125 50" class="efficiency-class" style="--class-index: ${n}; fill: ${l}" preserveAspectRatio="xMaxYMid slice"><path d="M -10000 0 h 10100 l 25 25 l -25 25 h -10100 Z" stroke="none"/></svg> <svg class="efficiency-class-text" style="--class-index: ${n};"><text class="text" x="8px" y="50%">${t[0]}</text>${g}</svg></div>`}),"renderBands"),L=s((e,i,c,t)=>{const l=y(e,i);return f`<div class="french-efficiency-grid">${$(l,c,t)}</div>`},"renderFrenchLayout"),k=s((e,i)=>e.findIndex(c=>c===i),"getIndexBySelectedClass"),E=s((e,i,c,t,l,n)=>e==="french"?L(i,c,l,n):z(i,c,t,l),"renderLayout"),o=class o extends b{constructor(){super(...arguments),this.efficiencyClasses=[],this.efficiencyClassColors=null,this.selectedClass="",this.energyLabelHeaderText="",this.selectedClassText="",this.layout="default"}updated(i){if(super.update(i),i.has("selectedClass")||i.has("efficiencyClasses")){const c=k(this.efficiencyClasses,this.selectedClass);c>-1?this.__setSelectedClassGraphPosition(c):this.__hideEfficiencyLabel()}i.has("energyLabelHeaderText")&&(this.energyLabelHeaderText.length?this.setAttribute("header-visible",""):this.removeAttribute("header-visible")),i.has("layout")&&(this.layout==="french"?this.setAttribute("layout-french",""):this.removeAttribute("layout-french"))}firstUpdated(){this.energyLabelHeaderText&&setTimeout(()=>{this._recalculateEnergyLabel()},0)}__hideEfficiencyLabel(){this.shadowRoot.querySelector(".efficiency-grid-container").classList.add("hidden")}__setSelectedClassGraphPosition(i){this.shadowRoot.querySelector(".efficiency-grid-container").classList.remove("hidden"),this.layout!=="french"&&(this.shadowRoot.getElementById("selectedEfficiency").style.gridRow=String(i+1))}render(){return f`<div class="efficiency-grid-container">${E(this.layout,this.efficiencyClasses,this.efficiencyClassColors,this.energyLabelHeaderText,this.selectedClass,this.selectedClassText)}</div>`}connectedCallback(){super.connectedCallback(),this.energyLabelHeaderText&&(this._recalculateEnergyLabel=this._recalculateEnergyLabel.bind(this),addEventListener("resize",this._recalculateEnergyLabel))}disconnectedCallback(){this.energyLabelHeaderText&&removeEventListener("resize",this._recalculateEnergyLabel),super.disconnectedCallback()}_recalculateEnergyLabel(){const c=this.shadowRoot.querySelector(".efficiency-grid-container").clientWidth,t=c*1.33;this.style.setProperty("--container-height",t+"px"),this.style.setProperty("--header-margin-bottom",t/40-1+"px"),this.style.setProperty("--header-font-size",15+Math.floor(c/215)+"px"),this.style.setProperty("--band-height",t/10+"px"),this.style.setProperty("--efficiency-label-holder-font-size",t/10-4+"px"),this.style.setProperty("--efficiency-grid-row-gap",t/60+Math.ceil(c/215)-1.6+"px"),this.style.setProperty("--selected-label-holder-font-size",t/10-4+"px")}};s(o,"WebcomEnergyLabel");let a=o;a.styles=x`
    :host {
      --padding: 0;
      --border: none;
      --max-width: 280px;
      --max-width--mobile: 135px;

      /* Colors for efficiency classes */
      --opaque-background-color: #fff;

      /* Available efficiency classes (on the left) */
      --efficiency-class-gap: 5px;
      --efficiency-class-gap--mobile: 2px;
      --efficiency-class-base-width: 58px;
      --efficiency-class-base-width--mobile: 28px;
      --efficiency-class-height: 30px;
      --efficiency-class-height--mobile: 15px;
      --efficiency-class-width: calc(var(--efficiency-class-base-width) + var(--efficiency-class-height) / 2);
      --efficiency-class-font: bold var(--efficiency-class-label-font-size) / var(--efficiency-class-label-line-height)
        var(--efficiency-class-font-family);

      --efficiency-class-font-family: Arial, Roboto, Noto, -apple-system, sans-serif;
      --efficiency-class-label-font-size: 29px;
      --efficiency-class-label-font-size--mobile: 15px;
      --efficiency-class-label-line-height: 1;
      --efficiency-class-label-color: #fff;

      --efficiency-class-size-difference: 5%;

      /* Selected efficiency class (on the right) */
      --selected-efficiency-width: 60px;
      --selected-efficiency-width--mobile: 30px;
      --selected-efficiency-height: 37px;
      --selected-efficiency-height--mobile: 22px;
      --selected-efficiency-arrow-width: calc(var(--selected-efficiency-width) + var(--selected-efficiency-height) / 2);
      --selected-efficiency-label-color: #fff;
      --selected-efficiency-background: #000;
      --selected-efficiency-border-color: #000;

      /* Selected efficiency label class (french market) */
      --selected-efficiency-class-label-font-size: 49px;
      --selected-efficiency-class-label-line-height: 1;
      --selected-efficiency-class-font: bold var(--selected-efficiency-class-label-font-size) / var(--selected-efficiency-class-label-line-height)
        var(--efficiency-class-font-family);

      /* Selected efficiency label text (french market) */
      --selected-efficiency-label-font-size: 35px;
      --selected-efficiency-label-line-height: normal;
      --selected-efficiency-label-font: bold var(--selected-efficiency-label-font-size) / var(--selected-efficiency-label-line-height)
        var(--efficiency-class-font-family);

      /* settings to adjust the alignment of the text-sup content (+) */
      --selected-efficiency-text-sup-font-size: 50%;
      --selected-efficiency-text-sup-alignment-baseline: auto;
    }

    :host([header-visible]) {
      --padding: 10px 5px;
      --border: 1px solid #000;

      --min-width: 212px;
      --max-width: 300px;
      --max-width--mobile: 300px;
      
      --efficiency-class-size-difference: 10.8%;

      --efficiency-class-height: 39px;
      --efficiency-class-height--mobile: 39px;
      --efficiency-class-gap: 9px;
      --efficiency-class-gap--mobile: 9px;
      --efficiency-class-base-width: 20%;
      --efficiency-class-base-width--mobile: 20%;
      --efficiency-class-width: calc(var(--efficiency-class-base-width) + var(--efficiency-class-height) / 2);
      --efficiency-class-font: bold var(--efficiency-class-label-font-size) / var(--efficiency-class-label-line-height)
        var(--efficiency-class-font-family);

      --efficiency-class-label-font-size: 29px;
      --efficiency-class-label-font-size--mobile: 29px;

      /* Selected efficiency class (on the right) */
      --selected-efficiency-width: 58px;
      --selected-efficiency-width--mobile: 58px;
      --selected-efficiency-height: 39px;
      --selected-efficiency-height--mobile: 39px;
      --selected-efficiency-arrow-width: calc(var(--selected-efficiency-width) + var(--selected-efficiency-height) / 2);
      --selected-efficiency-label-color: #fff;
      --selected-efficiency-background: #000;
      --selected-efficiency-border-color: #000;
    }

    :host([header-visible]) .efficiency-grid-container {
      min-width: var(--min-width);
      height: var(--container-height);
    }

    :host([header-visible]) .efficiency-grid {
      height: auto;
      row-gap: var(--efficiency-grid-row-gap);
      grid-template-rows: var(--band-height);
    }

    :host([header-visible]) .efficiency-class-text {
      top: 0;
    }

    :host([layout-french]) {
      --max-width: 280px;
      --max-width--mobile: 280px;
      --efficiency-class-gap: 5px;
      --efficiency-class-gap--mobile: 5px;
      --efficiency-class-base-width: 90px;
      --efficiency-class-base-width--mobile: 90px;
      --efficiency-class-height: 31px;
      --efficiency-class-height--mobile: 31px;
      --efficiency-class-size-difference: 11%;
      --efficiency-class-label-font-size: 21px;
      --efficiency-class-label-font-size--mobile: 21px;
      --selected-efficiency-width: calc(var(--efficiency-class-width) + 6 * var(--efficiency-class-size-difference));
      --selected-efficiency-width--mobile: calc(var(--efficiency-class-width) + 6 * var(--efficiency-class-size-difference));
      --selected-efficiency-height: calc(var(--efficiency-class-height) * 2);
      --selected-efficiency-height--mobile: calc(var(--efficiency-class-height) * 2);
      --selected-efficiency-class-label-font-size: 31px;
      --selected-efficiency-class-label-line-height: 1;
      --selected-efficiency-label-font-size: 18px;
      --selected-efficiency-label-line-height: normal;
    }

    .efficiency-grid-container {
      display: inline-block;
      width: 100%;
      max-width: var(--max-width);
      padding: var(--padding);
      border: var(--border);
      box-sizing: border-box;
    }

    .efficiency-grid-header {
      display: none;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 1px solid #000;
      margin-bottom: 15px;
      font: bold 17px/1 var(--efficiency-class-font-family);
      text-align: left;
    }

    :host([header-visible]) .efficiency-grid-header {
      display: flex;
      margin-bottom: var(--header-margin-bottom);
      font-size: var(--header-font-size);
    }

    :host([header-visible]) .efficiency-class-text .text {
      transform: translate(0px, 33.33%);
    }

    :host([header-visible]) .efficiency-class-holder {
      height: var(--band-height);
    }

    :host([header-visible]) .efficiency-class-holder .efficiency-class-text{
      height: var(--band-height);
    }

    :host([header-visible]) .efficiency-class-holder text.text{
      height: var(--band-height);
      font-size: var(--efficiency-label-holder-font-size);
      text-anchor: end;
    }



    :host([header-visible]) #selectedEfficiency {
      width: 100%;
      height: var(--band-height);
    }

    :host([header-visible]) #selectedEfficiency .selected-efficiency-class-text {
      height: var(--band-height);
    }

    :host([header-visible]) #selectedEfficiency text.text {
      height: var(--band-height);
      font-size: var(--selected-label-holder-font-size);
    }

    .efficiency-grid-flag {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      margin-right: 5px;
      pointer-events: none;
    }

    .efficiency-grid,
    .french-efficiency-grid {
      position: relative;
      display: grid;
      grid-template-columns: auto var(--selected-efficiency-arrow-width);
      grid-template-rows: repeat(auto-fit, var(--efficiency-class-height));
      grid-row-gap: var(--efficiency-class-gap);
      width: 100%;
      height: 100%;
      background-color: var(--opaque-background-color);
      pointer-events: none;
    }

    .french-efficiency-grid {
      grid-template-rows: repeat(auto-fit, minmax(var(--efficiency-class-height)));
      grid-template-columns: auto;
    }

    .efficiency-class-holder {
      position: relative;
      display: flex;
      height: var(--efficiency-class-height);
      grid-column: 1;
    }

    .french-efficiency-grid .efficiency-class-holder.efficiency-class-holder--selected {
      height: var(--selected-efficiency-class-height);
    }

    .french-efficiency-grid .efficiency-class-holder--selected .efficiency-class {
      width: var(--selected-efficiency-width);
      height: var(--selected-efficiency-height);
    }

    .efficiency-class-holder--selected .text {
      font: var(--selected-efficiency-class-font);
    }

    .efficiency-class {
      --class-index: 0;
      width: calc(var(--efficiency-class-width) + var(--class-index) * var(--efficiency-class-size-difference));
    }

    .efficiency-class-text {
      --class-index: 0;
      position: absolute;
      bottom: 0;
      left: 0;
      width: calc(var(--efficiency-class-width) + var(--class-index) * var(--efficiency-class-size-difference) - var(--efficiency-class-height) / 2);
      height: var(--efficiency-class-height);
    }

    .french-efficiency-grid .efficiency-class-holder--selected .efficiency-class-text {
      width: var(--selected-efficiency-width);
      height: var(--selected-efficiency-height);
      top: 0px;
    }

    .french-efficiency-grid .efficiency-class-holder--selected .efficiency-label-text {
      font: var(--selected-efficiency-label-font);
      fill: white;
      top: 0px;
    }

    .text {
      font: var(--efficiency-class-font);
      fill: var(--efficiency-class-label-color);
      transform: translate(0, 0.37em);
      text-anchor: start;
    }

    .text-sup {
      font-size: var(--selected-efficiency-text-sup-font-size);
      alignment-baseline: var(--selected-efficiency-text-sup-alignment-baseline);
    }

    #selectedEfficiency {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      grid-column: 2;
      align-self: center;
      max-width: 120px;
      height: var(--efficiency-class-height);
      overflow: visible;
      width: max-content;
    }

    .selected-efficiency-class {
      width: 100%;
      height: var(--selected-efficiency-height);
      fill: var(--selected-efficiency-background);
    }

    .selected-efficiency-class-text {
      position: absolute;
      left: calc(var(--selected-efficiency-height) / 2);
      width: var(--selected-efficiency-width);
      height: var(--selected-efficiency-height);
    }

    .selected-efficiency-class-text .text {
      text-anchor: middle;
    }

    .hidden {
      display: none;
    }

    @media screen and (max-width: 767px) {
      :host {
        --max-width: var(--max-width--mobile);
        --efficiency-class-gap: var(--efficiency-class-gap--mobile);
        --efficiency-class-base-width: var(--efficiency-class-base-width--mobile);
        --efficiency-class-height: var(--efficiency-class-height--mobile);
        --efficiency-class-label-font-size: var(--efficiency-class-label-font-size--mobile);
        --selected-efficiency-width: var(--selected-efficiency-width--mobile);
        --selected-efficiency-height: var(--selected-efficiency-height--mobile);
      }
    }
  `;r([d({type:Array,attribute:"efficiency-classes",converter:s(e=>e.replace(/['" [\]]/g,"").split(","),"converter")})],a.prototype,"efficiencyClasses",void 0);r([d({type:Object,attribute:"efficiency-class-colors",converter:s(e=>JSON.parse(e),"converter")})],a.prototype,"efficiencyClassColors",void 0);r([d({type:String,attribute:"selected-class"})],a.prototype,"selectedClass",void 0);r([d({type:String,attribute:"energy-label-header-text"})],a.prototype,"energyLabelHeaderText",void 0);r([d({type:String,attribute:"selected-class-text"})],a.prototype,"selectedClassText",void 0);r([d({type:String,attribute:"layout"})],a.prototype,"layout",void 0);window.customElements.define("webcom-energy-label",a);
