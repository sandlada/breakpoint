# AGENTS.md — @sandlada/breakpoint

断点库：监听 viewport / 任意元素 的宽度与高度，基于 `rxjs@^7.8.1`，零框架。

## 规则（必守）

- **函数式 + 高阶函数 + 参数后置**
- **测试**：`vitest` + `*.spec.ts` 与源码同目录（`src/**/*.spec.ts`），`jsdom` 环境
- **ESM + TreeShake + 无副作用**

## 测试与规格设计（Spec 规范）

- **契约/规格导向（Spec-First / Black-box）**：
  - 视被测代码为黑盒。测试断言必须严格依据业务需求、数学定义与接口规范**独立推导**期望值（Expected）。
  - **严禁以当前代码的实际输出（Actual）作为断言基准**，杜绝把错误实现固化为测试（如 `1+1` 误算为 `3` 时写出 `toBe(3)` 的荒谬测试）。
- **断言篡改红线**：
  - 当测试失败时，**默认是被测代码存在 Bug**，应检查并修复实现代码。
  - 严禁为了让测试通过而直接修改 `expect` 预期值去迎合实际输出；修改测试预期必须有明确的需求变更或规范修正依据。
- **覆盖维度**：
  - **数学与区间边界**：严格验证开闭区间（`>` / `>=` / `<` / `<=`）、临界值（如 `599px` vs `600px`）、单位换算（`rem` / `em` / `cm` / `in` / `pt` 等）。
  - **异步与流时序**：RxJS 流的多值推送、初始值触发、`unsubscribe` 资源释放与无泄漏验证。
  - **环境隔离**：区分 SSR 环境（`is-server.ts:7` 唯一判定）与 jsdom/Browser DOM 行为。
  - **边界与异常输入**：非法语法回退、空配置、非预期参数的默认处理与容错。

## AI 开发工作流（TDD 闭环）

必须遵循「**先测试后实现**」的闭环迭代：

1. **第 1 步：规格与边界推导（Spec Design）**
   - 梳理需求，独立推导输入/输出契约与关键临界值（±1px、空值、异常格式等）。
2. **第 2 步：先行编写正确且全面的测试（Red）**
   - **测试自检清单（Self-Audit）**：
     - ① 期望值是否纯依数学/规范推导，而非臆测或迎合现有实现？
     - ② 是否全面覆盖正常值、临界边界（±1）、空/非法输入、RxJS 生命周期（`unsubscribe` 资源释放）？
     - ③ 是否仅依赖公共 API 契约而非私有内部状态？
   - 编写 `*.spec.ts`，此时新增/修改的测试预期应暴露需求缺口（Red）。
3. **第 3 步：编写/调整实现代码（Green）**
   - 针对测试规范编写最精简、符合函数式风格的业务实现。
4. **第 4 步：测试-修复轮询（Loop 直到全过）**
   - 运行测试（`npm test` 或指定单测）。
   - **只修实现原则**：若测试失败，默认实现存在 Bug，**只修改源码文件（非 `*.spec.ts`）**，严禁篡改测试断言。
   - 持续「运行测试 → 定位源码 Bug → 修复源码」轮询，直到测试 **100% 全部通过（Exit Code 0）**。

## 命令

```bash
npm test              # vitest run
npm run test:watch    # vitest watch
npm run test:coverage # v8 — src/**/*.{ts,mts,cts} 排除 *.spec.ts
npm run lint:types    # tsc --noEmit --pretty（= typecheck）
npm run typecheck     # tsc --noEmit
npm run build         # tsdown → dist/index.js + dist/index.d.ts
npm run build:check   # tsc --noEmit
npm run dev           # tsdown --watch
```

单测：`npx vitest run src/breakpoint/breakpoints.spec.ts` / `npx vitest run -t "parseCondition"`。无 eslint/prettier。顺序 `lint:types → test → build`，测试无需先 `build`。

## 约定

- `is-server.ts:7` 唯一 SSR 判定
- 样式：单引号、4空格、LF、無行末分號
