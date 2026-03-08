/**
 * ai-tool-router
 * Automatic tool selection and execution router for AI agents.
 * @module ai-tool-router
 */

class AIToolRouter {
  constructor(options = {}) {
    this.callAI = options.callAI;
    this.tools = new Map();
    this.maxIterations = options.maxIterations || 5;
    if (!this.callAI) throw new Error('callAI function is required');
  }

  register(name, config) {
    this.tools.set(name, {
      description: config.description,
      parameters: config.parameters || {},
      execute: config.execute
    });
    return this;
  }

  async run(task) {
    let context = 'TASK: ' + task + '\n\n';
    const toolDescriptions = this._buildToolList();
    const history = [];

    for (let i = 0; i < this.maxIterations; i++) {
      const routePrompt = context + 'AVAILABLE TOOLS:\n' + toolDescriptions +
        '\n\nDecide: call a tool or provide final answer.' +
        '\nIf calling a tool, respond with JSON: {"tool":"name","args":{...}}' +
        '\nIf done, respond with JSON: {"done":true,"answer":"your final answer"}';

      const raw = await this.callAI(routePrompt, 'You are a precise AI agent. Use tools when needed.');
      const decision = this._parseDecision(raw);

      if (decision.done) {
        return { success: true, answer: decision.answer, history, iterations: i + 1 };
      }

      if (decision.tool && this.tools.has(decision.tool)) {
        const tool = this.tools.get(decision.tool);
        try {
          const result = await tool.execute(decision.args || {});
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
          context += 'TOOL CALL [' + decision.tool + ']: ' + JSON.stringify(decision.args) + '\n';
          context += 'RESULT: ' + resultStr + '\n\n';
          history.push({ tool: decision.tool, args: decision.args, result: resultStr });
        } catch (err) {
          context += 'TOOL ERROR [' + decision.tool + ']: ' + err.message + '\n\n';
          history.push({ tool: decision.tool, args: decision.args, error: err.message });
        }
      } else {
        context += 'INVALID TOOL: ' + (decision.tool || 'unknown') + '. Available: ' +
          Array.from(this.tools.keys()).join(', ') + '\n\n';
      }
    }

    return { success: false, answer: 'Max iterations reached', history, iterations: this.maxIterations };
  }

  _buildToolList() {
    let list = '';
    this.tools.forEach((tool, name) => {
      list += '- ' + name + ': ' + tool.description;
      if (Object.keys(tool.parameters).length > 0) {
        list += ' | Params: ' + JSON.stringify(tool.parameters);
      }
      list += '\n';
    });
    return list;
  }

  _parseDecision(raw) {
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end > start) return JSON.parse(raw.substring(start, end + 1));
    } catch (e) {}
    return { done: true, answer: raw };
  }
}

module.exports = AIToolRouter;