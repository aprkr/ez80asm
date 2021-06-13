// for (var fsPath in this.documents) {
//        const table = this.documents[fsPath]
//        if (table) {
//               this.writeTableToFile(table)
//        }
// }
// vscode.workspace.onDidSaveTextDocument((document) => {
//        const table = this.documents[document.uri.fsPath]
//        if (table) {
//               this.writeTableToFile(table)
//        }
// })

// /**
//         * @param {DocumentTable} table 
//         */
// writeTableToFile(table) {
//        const json = JSON.stringify(table)
//        const base = path.basename(table.fsPath)
//        const cachePath = path.join(this.cacheFolder, base + ".json");
//        fs.writeFile(cachePath, json, (error) => {
//               if (error) {
//                      console.log(error.message)
//               }
//        })
// }
// /**
//  * @param {String} fsPath 
//  */
// readTableFromFile(fsPath) {
//        const base = path.basename(fsPath)
//        const cachePath = path.join(this.cacheFolder, base + ".json");
//        if (!fs.existsSync(cachePath)) {
//               return null
//        }
//        // const fileStats = fs.statSync(fsPath)
//        const table = JSON.parse(fs.readFileSync(cachePath, "utf8"));
//        // if (table && table.fsPath == fsPath && table.lastModified == fileStats.mtimeMs) {
//        if (table && table.fsPath == fsPath) {
//               this.documents[fsPath] = table
//               for (let i = 0; i < table.includes.length; i++) {
//                      this.readTableFromFile(table.includes[i])
//                      if (!this.documents[table.includes[i]]) {
//                             const fileURI = vscode.Uri.file(table.includes[i])
//                             vscode.workspace.openTextDocument(fileURI).then((document) => {
//                                    if (!this.documents[document.uri.fsPath]) {
//                                           this.declareSymbols(document);
//                                    }
//                             });
//                      }
//               }
//        }
// }

// this.symbolRenameEmitter = new vscode.EventEmitter()
// this.renameTimeout = 0
// this.onDidRenameSymbol = (event) => {
//        this.renameTimeout = setTimeout(() => { this.renameTimeout = 0 }, 50)
// };
// this.symbolRenameEmitter.event(this.onDidRenameSymbol)


// const equateRegexold = /^[\s]*[a-zA-Z_][a-zA-Z_0-9]*[\W]+(equ|set)[\W]+.*$/i;
// const directiveRegex = /(\b|\.)(org|ds|db|dw|dl|assume|list|nolist|end|equ)\b/gi
// const nonCommentRegex = /^([^;]+[^\,\s;])/g
// const nonRegRegex = /((\$|0x)[A-Fa-f0-9]+\b)|(%[01]+\b)|(\b[01]+b\b)|(\b[0-9]+d?\b)|\b([A-Fa-f0-9]+h\b)|\b(A|B|C|D|E|F|H|L|I|R|IX|IY|IXH|IXL|IYH|IYL|AF|BC|DE|HL|PC|SP|AF'|MB)\b|\b(equ|set)\b/gi
// const wordregex = /([\w\.]+(\.\w+)?(\.|\b))/g

// checkUnknowns() {
//        for (var fsPath in this.documents) {
//               const table = this.documents[fsPath]
//               const unknowns = this.getAllinTable(table, "unknowns", [])
//               const symbols = this.getAllof(table.fsPath, "symbol", {})
//               for (let i = 0; i < unknowns.length; i++) {
//                      const unknown = unknowns[i]
//                      const line = table.lines[unknown.line]
//                      const symbol = this.checkSymbol(unknown.name, table.fsPath, symbols)
//                      const diagIndex = line.diagnostics.findIndex((diag) => {
//                             return diag.name == unknown.name
//                      })
//                      if (diagIndex != -1) {
//                             line.diagnostics.splice(diagIndex, 1)
//                      }
//                      if (!symbol) {
//                             const diag = new vscode.Diagnostic(unknown.range, "Bad symbol")
//                             diag.name = unknown.name
//                             line.diagnostics.push(diag)
//                      } else {
//                             const unknownIndex = line.unknowns.findIndex((ref) => {
//                                    return ref.range.start.character == unknown.range.start.character
//                             })
//                             // symbol.refs.push(unknown)
//                             line.refs.push(unknown)
//                             line.unknowns.splice(unknownIndex, 1)
//                      }
//               }
//               if (vscode.workspace.getConfiguration().get("ez80-asm.diagnosticProvider")) {
//                      const uri = vscode.Uri.file(table.fsPath)
//                      this.collection.set(uri, this.getDocDiags(table))
//               }

//        }
// }

// const opcode = diagwordmatch[0]
//                      let opcodeskip = false
//                      if (normalLine && opcode) {      // check the opcode
//                             const startChar = docLine.text.indexOf(opcode)
//                             const endChar = startChar + opcode.length
//                             if (opcode.indexOf(".") != -1 && !opcode.match(suffixRegex)) {       // if the suffix isn't valid
//                                    const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
//                                    line.diagnostics.push(new vscode.Diagnostic(range, "Bad suffix"));
//                                    continue
//                             } else if (opcode.indexOf(".") != -1) {
//                                    diagline = diagline.replace(/\.\w+/, "")  // remove the suffix from the test line if it's valid
//                             }
//                             if (!opcode.match(opcodeRegex)) {        // if the opcode isn't valid
//                                    const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
//                                    line.diagnostics.push(new vscode.Diagnostic(range, "Unknown opcode"));
//                                    continue
//                             } else if (opcode.match(noOperandOpcodeRegex)) { // if the opcode doesn't use an operand
//                                    if (diagwordmatch.length > 1) {
//                                           const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
//                                           line.diagnostics.push(new vscode.Diagnostic(range, "No operand needed for this opcode"));
//                                           continue
//                                    } else {
//                                           opcodeskip = true    // ret
//                                    }
//                             }
//                      } else if (!opcode) {
//                             opcodeskip = true
//                      }
//                      if (!opcodeskip) {
//                             line.unknowns = []
//                             line.refs = []
//                             let startChar = -1
//                             for (let i = 1; i < diagwordmatch.length; i++) {    // replace all the symbols with "number"
//                                    startChar = docLine.text.indexOf(diagwordmatch[i], startChar + 1)
//                                    if (diagwordmatch[i].match(registerRegex)) { // match register
//                                           continue
//                                    } else if (i == 1 && diagwordmatch[i].match(conditionalRegex)) { // conditional
//                                           continue
//                                    } else if (diagwordmatch[i] === validNumber) {
//                                           continue
//                                    } else if (diagwordmatch[i].match(/\'.\'/)) { // char literal
//                                           continue
//                                    } else if (diagwordmatch[i].match(numberRegex)) { // number
//                                           continue
//                                    } else { // symbol
//                                           const symbol = this.checkSymbol(diagwordmatch[i], document.uri.fsPath)
//                                           if (symbol) {
//                                                  diagline = diagline.replace(diagwordmatch[i], validNumber)
//                                                  const endChar = startChar + diagwordmatch[i].length
//                                                  const ref = new possibleRef(startChar, endChar, diagwordmatch[i], document.uri.fsPath, lineNumber)
//                                                  line.refs.push(ref)
//                                           } else {
//                                                  const endChar = startChar + diagwordmatch[i].length
//                                                  const ref = new possibleRef(startChar, endChar, diagwordmatch[i], document.uri.fsPath, lineNumber)
//                                                  line.refs.push(ref)
//                                           }
//                                    }
//                             }
//                             if (!normalLine) {
//                                    continue
//                             }
//                             diagline = this.formatLine(diagline);
//                             let operands = this.getOperands(diagline);
//                             diagline = diagline.replace(/(.+)/g, function (match) {
//                                    const opcode = match.match(/^\s+(\w+)/)
//                                    for (let i = 0; i < operands.length; i++) {
//                                           operands[i] = operands[i].replace(/ /g, "")
//                                    }
//                                    if (operands.length == 1) {
//                                           return opcode[1] + " " + operands[0]
//                                    } else if (operands.length == 2) {
//                                           return opcode[1] + " " + operands[0] + ", " + operands[1]
//                                    } else if (operands.length == 0) {
//                                           return opcode[1]
//                                    } else {
//                                           return match
//                                    }
//                             })
//                             diagline = this.evalOperands(diagline, operands)
//                             diagline = diagline.replace(bitopcodes, (match) => {
//                                    return match.replace(valid, "bit")
//                             })
//                             const invalid = this.testLine(diagline)
//                             if (invalid) {
//                                    const endChar = textLength;
//                                    const range = new vscode.Range(lineNumber, 0, lineNumber, endChar)
//                                    line.diagnostics.push(new vscode.Diagnostic(range, "Bad operands"));
//                             }
//                      }
//                      continue

// if (!symbol) {
//        const diag = new vscode.Diagnostic(ref.range, "Bad symbol") // I'm not sure this is even necessary
//        diag.name = ref.name
//        line.diagnostics.push(diag)
// } else {
//        const outputItem = new possibleRef(ref.startChar, ref.endChar, ref.name, ref.fsPath, ref.line)
//        outputItem.symbol = symbol
//        output.push(outputItem)
//        const index = line.diagnostics.findIndex((diag) => {
//               return diag.name == ref.name
//        })
//        if (index != -1) {
//               line.diagnostics.splice(index, 1)
//        }
// }

// if (opcode) {      // check the opcode
//        const startChar = docLine.text.indexOf(opcode)
//        const endChar = startChar + opcode.length
//        if (opcode.indexOf(".") != -1 && !opcode.match(suffixRegex)) {       // if the suffix isn't valid
//               const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
//               line.diagnostics.push(new vscode.Diagnostic(range, "Bad suffix"));
//               continue
//        } else if (opcode.indexOf(".") != -1) {
//               diagline = diagline.replace(/\.\w+/, "")  // remove the suffix from the test line if it's valid
//        }
//        if (!opcode.match(opcodeRegex)) {        // if the opcode isn't valid
//               const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
//               line.diagnostics.push(new vscode.Diagnostic(range, "Unknown opcode"));
//               continue
//        } else if (opcode.match(noOperandOpcodeRegex)) { // if the opcode doesn't use an operand
//               if (diagwordmatch.length > 1) {
//                      const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
//                      line.diagnostics.push(new vscode.Diagnostic(range, "No operand needed for this opcode"));
//                      continue
//               } else {
//                      opcodeskip = true    // ret
//               }
//        }
// } else if (!opcode) {
//        opcodeskip = true
// }
// if (!opcodeskip) {
//        line.unknowns = []
//        line.refs = []
//        let startChar = -1
//        for (let i = 1; i < diagwordmatch.length; i++) {    // replace all the symbols with "number"
//               startChar = docLine.text.indexOf(diagwordmatch[i], startChar + 1)
//               if (diagwordmatch[i].match(registerRegex)) { // match register
//                      continue
//               } else if (i == 1 && diagwordmatch[i].match(conditionalRegex)) { // conditional
//                      continue
//               } else if (diagwordmatch[i] === validNumber) {
//                      continue
//               } else if (diagwordmatch[i].match(/\'.\'/)) { // char literal
//                      continue
//               } else if (diagwordmatch[i].match(numberRegex)) { // number
//                      continue
//               } else { // symbol
//                      const symbol = this.checkSymbol(diagwordmatch[i], document.uri.fsPath)
//                      if (symbol) {
//                             diagline = diagline.replace(diagwordmatch[i], validNumber)
//                             const endChar = startChar + diagwordmatch[i].length
//                             const ref = new possibleRef(startChar, endChar, diagwordmatch[i], document.uri.fsPath, lineNumber)
//                             line.refs.push(ref)
//                      } else {
//                             const endChar = startChar + diagwordmatch[i].length
//                             const ref = new possibleRef(startChar, endChar, diagwordmatch[i], document.uri.fsPath, lineNumber)
//                             line.refs.push(ref)
//                      }
//               }
//        }
//        if (!normalLine) {
//               continue
//        }
//        diagline = this.formatLine(diagline);
//        let operands = this.getOperands(diagline);
//        diagline = diagline.replace(/(.+)/g, function (match) {
//               const opcode = match.match(/^\s+(\w+)/)
//               for (let i = 0; i < operands.length; i++) {
//                      operands[i] = operands[i].replace(/ /g, "")
//               }
//               if (operands.length == 1) {
//                      return opcode[1] + " " + operands[0]
//               } else if (operands.length == 2) {
//                      return opcode[1] + " " + operands[0] + ", " + operands[1]
//               } else if (operands.length == 0) {
//                      return opcode[1]
//               } else {
//                      return match
//               }
//        })
//        diagline = this.evalOperands(diagline, operands)
//        diagline = diagline.replace(bitopcodes, (match) => {
//               return match.replace(valid, "bit")
//        })
//        const invalid = this.testLine(diagline)
//        if (invalid) {
//               const endChar = textLength;
//               const range = new vscode.Range(lineNumber, 0, lineNumber, endChar)
//               line.diagnostics.push(new vscode.Diagnostic(range, "Bad operands"));
//        }
// }
// formatLine(line) {
//        line = line.toLowerCase();
//        line = line.replace(/(\+|-|\/|\*)/gi, "+")
//        line = line.replace(/\'.+\'/, validNumber)
//        return line
// }
// getOperands(line) {
//        let operands = []
//        let operand = line.match(firstoperandregex)
//        if (operand) {
//               operands.push(operand[1])
//        }
//        operand = line.match(secondoperandregex)
//        if (operand) {
//               operands.push(operand[1])
//        }
//        return operands
// }
// testLine(line) {
//        if (this.instructionItemsNonForm.indexOf(line) != -1) {
//               return false
//        }
//        let test = line.replace(validRegex, bigNumber)
//        if (this.instructionItemsNonForm.indexOf(test) != -1) {
//               return false
//        }
//        test = line.replace(validRegex, smallNumber)
//        if (this.instructionItemsNonForm.indexOf(test) != -1) {
//               return false
//        }
//        test = line.replace(validRegex, offset)
//        if (this.instructionItemsNonForm.indexOf(test) != -1) {
//               return false
//        }
//        return true
// }
// evalOperands(line, operands) {
//        for (let i = 0; i < operands.length; i++) {
//               try {
//                      eval(operands[i].replace(evalReg, 1))
//                      let withoutParen = operands[i].match(/(?<=^\()(.*)(?=\)$)/)
//                      if (!withoutParen) {
//                             withoutParen = [operands[i]]
//                      }
//                      withoutParen[0] = withoutParen[0].replace(replacementRegex, "")
//                      if (withoutParen[0] === "") {
//                             continue
//                      }
//                      line = line.replace(withoutParen[0], valid)
//               } catch (err) {
//               }
//        }
//        return line
// }

