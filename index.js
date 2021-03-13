//插件是顺序执行 presets是逆序执行 先执行完plugins在执行presets

const catchTemplate = `
    try {
        ERROR_VARIABLE.message += FUNC_MSG;
        window.JsTracker.catch(ERROR_VARIABLE);
    }catch(e){
    
    }
`;

function isFuncType(type) {
  return (
    type &&
    [
      "FunctionExpression",
      "ArrowFunctionExpression",
      "FunctionDeclaration",
    ].indexOf(type) > -1
  );
}

module.exports = function ({ types: t, template }) {
  function replaceFuncBody(path, { astTemplate, whiteList = [] }) {
    if (!path) return;
    if (!path.node) return;
    if (!path.node.body) return;
    if (path.node.body.type !== "BlockStatement") return;
    const body = path.node.body.body;
    if (!body || body.length === 0) {
      return;
    }
    const firstBodyChild = body[0];

    if (firstBodyChild.type === "TryStatement") return;

    const secondNode = body[1];
    if (secondNode && secondNode.type === "TryStatement") return;

    let len = body.length;

    let flag = false;

    for (let i = 0; i < len; i++) {
      var cur = body[i];
      if (cur.type && cur.type === "ExpressionStatement") {
        const nextNode = cur.expression;
        if (nextNode && nextNode.type === "CallExpression" && nextNode.callee) {
          const nextNodeCalleeType = nextNode.callee.type;
          if (
            isFuncType(nextNodeCalleeType) ||
            ["MemberExpression", "Identifier"].indexOf(nextNodeCalleeType) > -1
          ) {
            flag = true;
            continue;
          }
        }
      }

      if (cur && ["TryStatement", "ReturnStatement"].indexOf(cur.type) === -1) {
        flag = false;
        break;
      }
    }
    if (flag) return;
    const errorVariableName = path.scope.generateUidIdentifier("e");

    const node = path.node;
    let name = "";
    let funcLoc = node.loc;
    const funcId = node.id || node.key; //普通函数和classMethod

    if (funcId && funcId.type === "Identifier") {
      name = funcId.name || "";
      if (!funcLoc && funcId.loc) funcLoc = funcId.loc;
    }

    let funcLine = funcLoc && funcLoc.start ? funcLoc.start.line + "" : "";
    const message = name + funcLine;
    const ast = astTemplate({
      FUNC_BODY: body,
      ERROR_VARIABLE: errorVariableName,
      FUNC_MSG: t.StringLiteral(message),
    });
    path.get("body").replaceWith(ast);
  }
  const wrapCaptureWithThrow = template(`{
        try{
            FUNC_BODY
        }catch(ERROR_VARIABLE){
            ${catchTemplate}
            throw ERROR_VARIABLE;
        }
    }`);

  return {
    visitor: {
      // 箭头函数替换
      ArrowFunctionExpression(path, options = {opts:{}}) {
        var { parent, node } = path;
        if (!parent) return;
        if (
          [
            "Program",
            "ExportNamedDeclaration",
            "ExportDefaultDeclaration",
          ].indexOf(parent.type) < 0
        )
          return;
        if (!node.id) return;
        if (!node.id.name) return;
        replaceFuncBody(path, { astTemplate: wrapCaptureWithThrow });
      },
      // 函数声明替换
      FunctionDeclaration(path, options = {opts:{}}) {
        var { parent, node } = path;
        if (!parent) return;
        if (
          [
            "Program",
            "ExportNamedDeclaration",
            "ExportDefaultDeclaration",
          ].indexOf(parent.type) < 0
        )
          return;
        if (!node.id) return;
        if (!node.id.name) return;
        replaceFuncBody(path, { astTemplate: wrapCaptureWithThrow });
      },
      // 类里的方法替换
      ClassDeclaration(path, options = {opts:{}}) {
        if (!path) return;
        if (!path.node) return;
        if (!path.node.body) return;
        const body = path.get("body").get("body");
        if (body.length === 0) {
          return;
        }

        body.forEach(function (b) {
          if (!b) return;
          if (!b.node) return;
          if (!b.node.type) return;
          if (["ClassProperty", "ClassMethod"].indexOf(b.node.type) === -1)
            return;

          if (b.node.type === "ClassProperty") {
            b = b.get("value");
            if (!b) return;
            if (!b.node) return;
            if (!isFuncType(b.type)) return;
          }
          replaceFuncBody(b, {
            astTemplate: wrapCaptureWithThrow,
            whiteList: [],
          });
        });
      },
      // 变量声明替换
      VariableDeclarator(path, options = {opts:{}}) {
        if (!path) return;
        const { parent } = path;

        if (!parent) return;
        if (parent.type !== "VariableDeclaration") return;
        const init = path.get("init");
        if (!init) return;
        if (init.type && !isFuncType(init.type)) return;

        replaceFuncBody(init, { astTemplate: wrapCaptureWithThrow });
      },

      Function(path, options = {opts:{}}) {
          const parent = path.parent;

        if (!parent) return;

        if (!parent.callee) return;
        const calleeName = parent.callee.name;
        if (checkAsync(calleeName))
          return replaceFuncBody(path, { astTemplate: wrapCaptureWithThrow });
        const prop = parent.callee.property;
        if (prop && checkAsyncProp(prop.name))
          return replaceFuncBody(path, { astTemplate: wrapCaptureWithThrow });

        const parentType = parent.type;
        if (parentType === "ExpressionStatement")
          return replaceFuncBody(path, { astTemplate: wrapCaptureWithThrow });
      },

      CallExpression(path, options = {opts:{}}) {
        if (!path.node) return;
        if (!path.node.callee) return;
        const calleeProp = path.node.callee.property;
        const calleeObject = path.node.callee.object;
      },
    },
  };
};

function checkAsync(name) {
  if (!name) return false;
  return ["setTimeout", "setInterval", "Promise"].indexOf(name) > -1;
}

function checkAsyncProp(name) {
  if (!name) return false;
  return ["requestAnimationFrame", "then"].indexOf(name) > -1;
}

function isWhiteList(funcName, whiteList) {
  // let list = ['_defineProperty', 'defineProperties', '_classCallCheck', '_possibleConstructorReturn', '_inherits', '_objectWithoutProperties', '_createClass'];
}


console.log('a');
console.log('b');
console.log('c');
