import Page from "../page.js";
export default class RoundPlayer extends Page {
  constructor(params) {
    super(params);
  }

  getHtml() {
    return `
                <div>
                    round
                </div>
            `;
  }
}
