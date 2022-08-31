import type * as swc from '@swc/core'
import BaseVisitor from '@swc/core/Visitor'
import * as ast from './ast'
import { createDebug } from './debug'
import { ImportResult, PluginContext } from './types'

export class CallVisitor extends BaseVisitor {
  constructor(private ctx: PluginContext) {
    super()
  }

  import: ImportResult | undefined

  visitImportDeclaration(node: swc.ImportDeclaration): swc.ImportDeclaration {
    const result = ast.importDeclaration(node, this.ctx.import)

    if (result) {
      createDebug('import', `Found import { ${result.identifer} } in ${this.ctx.import.filename}`)
      this.import = result
    }

    return node
  }

  visitCallExpression(node: swc.CallExpression): swc.Expression {
    // bail out if the function we're interested in has not been called
    if (!this.import) return node
    const expression = ast.callExpression(node, this.import.alias)
    if (!expression) return node

    const args = expression.arguments
    if (!args.length || args.length > 2) return node

    if (args.length === 2) {
      //
      const [name, config] = args

      if (name.expression.type === 'StringLiteral' && config.expression.type === 'ObjectExpression') {
        this.ctx.onData?.({
          type: 'named-object',
          name: name.expression.value,
          data: ast.objectExpression(config.expression),
        })
      }

      return node
    }

    const [config] = args

    if (config.expression.type === 'ObjectExpression') {
      this.ctx.onData?.({
        type: 'object',
        data: ast.objectExpression(config.expression),
      })
    }

    return node
  }
}

/* -----------------------------------------------------------------------------
 * Dynamic call expression visitor
 * -----------------------------------------------------------------------------*/

export class DynamicCallVisitor extends BaseVisitor {
  constructor(private ctx: PluginContext) {
    super()
  }

  imports: ImportResult[] | undefined

  visitImportDeclaration(node: swc.ImportDeclaration): swc.ImportDeclaration {
    const result = ast.importDeclarations(node, this.ctx.import.module)

    if (result) {
      createDebug('import', `Found import { ${result.map((t) => t.alias).join(', ')} } in ${this.ctx.import.filename}`)
      this.imports = result
    }

    return node
  }

  visitCallExpression(node: swc.CallExpression): swc.Expression {
    // bail out if the function we're interested in has not been called
    if (!this.imports) return node

    for (const _import of this.imports) {
      const expression = ast.callExpression(node, _import.alias)
      if (!expression) continue

      const args = expression.arguments

      if (args.length > 2) continue

      if (args.length) {
        const [config] = args
        if (config.expression.type === 'ObjectExpression') {
          this.ctx.onDynamicData?.(_import.alias, {
            type: 'object',
            data: ast.objectExpression(config.expression),
          })
        }
      } else {
        this.ctx.onDynamicData?.(_import.alias, {
          type: 'object',
          data: {},
        })
      }
    }

    return node
  }
}
