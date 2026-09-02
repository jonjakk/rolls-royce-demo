var n=Object.defineProperty;var c=(f,e)=>n(f,"name",{value:e,configurable:!0});import{aD as s}from"./index.1787754279.js";import{i as y,n as a,s as h,x as r}from"./chunk.query-assigned-elements.CfACBIZI.js";const o=class o extends h{constructor(){super(...arguments),this.efficiencyClass="",this.efficiencyColor="",this.minEfficiencyClass="",this.minEfficiencyColor="",this.maxEfficiencyClass="",this.maxEfficiencyColor="",this.altText="",this.efficiencyClassText=""}render(){return!this.efficiencyClassText||this.efficiencyClassText&&!this.efficiencyClassText.length?r``:r`<div class="efficiencyClassHolder" style="${this.__getEfficiencyClassStyles()}"><label id="efficiencyClassLabelText">${this.altText?this.altText+" ":""}${this.efficiencyClassText}</label><div aria-hidden="true">${this.efficiencyClassText}</div></div>`}updated(e){if(super.update(e),e.has("efficiencyClass")||e.has("minEfficiencyClass")||e.has("maxEfficiencyClass")){const t=o.computeEfficiencyData(this.efficiencyClass,this.minEfficiencyClass,this.maxEfficiencyClass);t.length?this.efficiencyClassText=t.length===2?`${t[0]} - ${t[1]}`:`${t[0]}`:this.efficiencyClassText=""}}__getEfficiencyClassStyles(){const e=o.computeEfficiencyData(this.efficiencyColor,this.minEfficiencyColor,this.maxEfficiencyColor);return e.length?`--min-color: ${e[0]}; --max-color: ${e.length===2?e[1]:e[0]}`:""}static computeEfficiencyData(e,t,l){return t&&l?t===l?[l]:[t,l]:l&&e?e===l?[l]:[e,l]:e?[e]:[]}};c(o,"WebcomEfficiencyClass");let i=o;i.styles=y`
    :host {
      --label-width: 40px;
      --label-height: 20px;

      --label-padding: 0 3px;
      --label-margin: -1px 10px 1px 0;

      --label-font-size: 12px;
      --label-font-family: Arial, Roboto, Noto, -apple-system, sans-serif;
      --label-font: bold var(--label-font-size) / var(--label-height) var(--label-font-family);
      --label-font-color: #fff;
    }

    .efficiencyClassHolder {
      --efficiency-class-border: calc(var(--label-height) / 2);

      position: relative;
      display: inline-block;
      box-sizing: border-box;
      min-width: var(--label-width);
      height: var(--label-height);
      padding: var(--label-padding);
      margin: var(--label-margin);
      background-image: linear-gradient(to right, var(--min-color, #000), var(--max-color, #000)); /** Variables updated with component logic **/
      color: var(--label-font-color);
      font: var(--label-font);
      text-align: center;
      vertical-align: middle;
    }

    .efficiencyClassHolder::before,
    .efficiencyClassHolder::after {
      display: none; /** Will only be displayed if classes .arrow-left or .arrow-right are set on the component **/
      content: '';
      position: absolute;
      top: 50%;
      width: 0;
      height: 0;
      border: var(--efficiency-class-border) solid transparent;
      margin-top: calc(var(--efficiency-class-border) * -1);
      pointer-events: none;
    }

    :host(.arrow-left) .efficiencyClassHolder::before,
    :host(.arrow-right) .efficiencyClassHolder::after {
      display: block;
    }

    .efficiencyClassHolder::before {
      right: 100%;
      border-right-color: var(--min-color, #000);
    }

    .efficiencyClassHolder::after {
      left: 100%;
      border-left-color: var(--max-color, #000);
    }

    #efficiencyClassLabelText {
      display: block;
      height: 0;
      width: 0;
      overflow: hidden;
    }

    /** FIXME: Property will overwrite values set on :host (outside style overwrites) **/
    @media screen and (max-width: 767px) {
      :host {
        --label-font-size: 9px;
      }
    }
  `;s([a({type:String,attribute:"efficiency-class"})],i.prototype,"efficiencyClass",void 0);s([a({type:String,attribute:"efficiency-color"})],i.prototype,"efficiencyColor",void 0);s([a({type:String,attribute:"min-efficiency-class"})],i.prototype,"minEfficiencyClass",void 0);s([a({type:String,attribute:"min-efficiency-color"})],i.prototype,"minEfficiencyColor",void 0);s([a({type:String,attribute:"max-efficiency-class"})],i.prototype,"maxEfficiencyClass",void 0);s([a({type:String,attribute:"max-efficiency-color"})],i.prototype,"maxEfficiencyColor",void 0);s([a({type:String,attribute:"alt-text"})],i.prototype,"altText",void 0);s([a({type:String})],i.prototype,"efficiencyClassText",void 0);window.customElements.define("webcom-efficiency-class",i);
