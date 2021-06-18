const vscode = require("vscode")
const path = require("path")

exports.RefsnDefs = class RefsnDefs {
      constructor(symbolDocumenter) {
            this.symbolDocumenter = symbolDocumenter
      }
      /**
       * 
       * @param {vscode.TextDocument} document 
       * @param {vscode.Position} position 
       * @param {vscode.CancellationToken} token 
       * @returns {vscode.Location} the vscode location of the symbol
       */
      provideDefinition(document, position, token) {
            let range = document.getWordRangeAtPosition(position, /\"[\w\.\:\\\/]+\"/g) // see if user is trying to open a file from include line
            if (range) {
                  const text = document.getText(range).replace(/\"/g, "")
                  const fsRelativeDir = path.dirname(document.uri.fsPath);
                  const filename = this.symbolDocumenter.resolveFilename(text, fsRelativeDir)
                  if (filename.length > 0 && this.symbolDocumenter.docTables[document.uri.fsPath].includes.get(filename)) {
                        return new vscode.Location(vscode.Uri.file(filename), new vscode.Position(0, 0))
                  }
            } else if (range = document.getWordRangeAtPosition(position, /([\w\.]+)/g)) {
                  const text = document.getText(range);
                  const symbolAndPath = this.symbolDocumenter.getSymbolAndPath(text, document.uri.fsPath)
                  if (symbolAndPath) {
                        return this.getLocation(symbolAndPath[0].name, symbolAndPath[1], symbolAndPath[0].line)
                  }
            }
            return undefined;
      }
      /**
        * 
        * @param {vscode.TextDocument} document 
        * @param {vscode.Position} position 
        * @param {vscode.ReferenceContext} context 
        * @param {vscode.CancellationToken} token 
        * @returns {vscode.Location[]} the array of reference locations
      */
      provideReferences(document, position, context, token) {
            const range = document.getWordRangeAtPosition(position, /([\w\.]+)/g);
            if (range) {
                  let output = []
                  const text = document.getText(range);
                  const symbolAndPath = this.symbolDocumenter.getSymbolAndPath(text, document.uri.fsPath)
                  if (symbolAndPath) {
                        const symbol = symbolAndPath[0]
                        output = this.getAllRefLocations(symbol.name, document.uri.fsPath)
                        if (context.includeDeclaration) {
                              output.push(this.getLocation(symbolAndPath[0].name, symbolAndPath[1], symbolAndPath[0].line))
                        }
                        return output
                  }
            }
      }
      /**
       * 
       * @param {vscode.TextDocument} document 
       * @param {vscode.Position} position 
       * @param {vscode.CancellationToken} token 
       * @returns {vscode.Range}
       * @throws error if range cannot be used or element can't be renamed
       */
      prepareRename(document, position, token) {
            const renameRange = document.getWordRangeAtPosition(position, /([_A-Za-z\.][\w\.]*)/g);
            if (!renameRange) {
                  throw "You cannot rename this element."
            }
            const text = document.getText(renameRange)
            const docTable = this.symbolDocumenter.docTables[document.uri.fsPath]
            const line = docTable.lines[renameRange.start.line]
            if ((!line.symbol || !line.symbol === text) && (!line.refs || !line.refs.includes(text))) {
                  throw "You cannot rename this element."
            }
            this.oldSymbolAndPath = this.symbolDocumenter.getSymbolAndPath(text, document.uri.fsPath)
            if (this.oldSymbolAndPath) {
                  if (this.oldSymbolAndPath[1].match(/\.inc$/) && this.oldSymbolAndPath[1] !== document.uri.fsPath) { // So you can't accidentally rename a symbol from a .inc file
                        throw "This symbol can only be changed in " + this.oldSymbolAndPath[1]
                  }
                  return renameRange
            } else {
                  throw "Symbol declaration not found"
            }
      }
      /**
       * 
       * @param {vscode.TextDocument} document 
       * @param {vscode.Position} position 
       * @param {String} newName 
       * @param {vscode.CancellationToken} token 
       * @returns {vscode.WorkspaceEdit}
       */
      provideRenameEdits(document, position, newName, token) {
            // if (newName.match(/;/g)) {
            //       throw "Invalid name"
            // }
            // const existingSymbol = this.symbolDocumenter.checkSymbol(newName, document.uri.fsPath)
            // if (existingSymbol) {
            //       throw "There is already a symbol with this name"
            // }
            const oldLocation = this.getLocation(this.oldSymbolAndPath[0].name, this.oldSymbolAndPath[1], this.oldSymbolAndPath[0].line)
            const edits = new vscode.WorkspaceEdit()
            edits.replace(oldLocation.uri, oldLocation.range, newName)
            const refs = this.getAllRefLocations(this.oldSymbolAndPath[0].name, document.uri.fsPath)
            for (let i = 0; i < refs.length; i++) {
                  const ref = refs[i]
                  edits.replace(ref.uri, ref.range, newName)
            }
            return edits
      }
      getLocation(name, fsPath, line) {
            const range = this.symbolDocumenter.getRange(name, line)
            const uri = vscode.Uri.file(fsPath)
            return new vscode.Location(uri, range)
      }
      /**
       * 
       * @param {String} name 
       * @param {String} fsPath 
       * @param {[]=} output 
       * @param {String[]=} searched 
       * @param {boolean} noSearchParent true to not search the parent
       * @returns 
       */
      getAllRefLocations(name, fsPath, output, searched, noSearchParent) {
            const docTable = this.symbolDocumenter.docTables[fsPath]
            let refArray = docTable.refs.get(name)
            if (!searched) {
                  output = []
                  searched = [fsPath]
            } else {
                  searched.push(fsPath)
            }
            if (refArray) {
                  for (let i = 0; i < refArray.length; i++) {
                        output.push(this.getLocation(name, fsPath, refArray[i]))
                  }
            }
            const includeTable = docTable.includes.getTable()
            if (includeTable.length > 0) {
                  for (let i = 0; i < includeTable.length; i++) {
                        if (!searched.includes(includeTable[i].key)) {
                              this.getAllRefLocations(name, includeTable[i].key, output, searched, true)
                        }
                  }
            }
            if (!noSearchParent) {
                  for (let i = 0; i < docTable.parents.length; i++) {
                        if (!searched.includes(docTable.parents[i])) {
                              this.getAllRefLocations(name, docTable.parents[i], output, searched)
                        }
                  }
            }
            return output
      }
}