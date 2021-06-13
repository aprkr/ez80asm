/**
 * A hash table for storing strings
 */
exports.HashTable = class HashTable {
      #hashtable
      #length
      #capacity
      /**
       * 
       * @param {Number} capacity 
       */
      constructor(capacity) {
            this.#hashtable = []
            this.#length = 0
            if (capacity) {
                  this.#capacity = capacity
            } else {
                  this.#capacity = 10;
            }
      }
      /**
       * 
       * @param {String} key 
       * @param {*} value 
       * @returns true if pair was successfully added
       */
      set(key, value) {
            const index = hash(key) % this.#capacity
            if (this.has(key)) {
                  return false
            }
            if (!this.#hashtable[index]) {
                  this.#hashtable[index] = []
            }
            this.#hashtable[index].push(new KeyValuePair(key, value))
            this.#length++
            if (this.#length / this.#capacity >= 0.85) {
                  this.#length = 0
                  let oldTable = this.#hashtable
                  let oldLength = this.#hashtable.length
                  this.#hashtable = []
                  this.#capacity = this.#capacity * 2
                  for (let i = 0; i < oldLength; i++) {
                        const array = oldTable[i]
                        if (!array) {
                              continue
                        } else {
                              for (let j = 0; j < array.length; j++) {
                                    const pair = array[j]
                                    this.set(pair.key, pair.value)
                              }
                        }
                  }

            }
            return true
      }
      /**
       * 
       * @param {String} key 
       */
      get(key) {
            try {
                  const index = hash(key) % this.#capacity
                  let pair
                  const array = this.#hashtable[index]
                  for (let i = 0; i < array.length; i++) {
                        if (array[i].key === (key)) {
                              pair = array[i]
                        }
                  }
                  return pair.value
            } catch (error) {
                  return null;
            }



      }
      /**
       * 
       * @returns current number of pairs in this table
       */
      length() {
            return this.#length
      }
      /**
       * 
       * @param {String} key 
       * @returns true if key is found
       */
      has(key) {
            if (this.get(key)) {
                  return true
            } else {
                  return false
            }
      }
      /**
       * Don't use with refs
       * @param {*} key 
       * @returns 
       */
      delete(key, lineNumber) {
            try {
                  const index = hash(key) % this.#capacity
                  let pair
                  const array = this.#hashtable[index]
                  let arrayIndex
                  for (arrayIndex = 0; arrayIndex < array.length; arrayIndex++) {
                        if (array[arrayIndex].key === (key)) {
                              pair = array[arrayIndex]
                              break;
                        }
                  }
                  if (lineNumber && pair.value.length) {
                        for (let i = 0; i < pair.value.length; i++) {
                              if (pair.value[i].lineNumber == lineNumber) {
                                    const output = (pair.value.splice(i, 1))[0]
                                    if (pair.value.length == 0) {
                                          array.splice(arrayIndex, 1)
                                          this.#length--
                                    }
                                    return output
                              }
                        }

                  }
                  array.splice(arrayIndex, 1)
                  this.#length--
                  return pair.value
            } catch (error) {
                  return null
            }
      }
      /**
       * Clears the table
       */
      clear() {
            table = []
            this.#length = 0
      }
      /**
       * 
       * @returns [] copy of the hash table without collisions or empty indexes
       */
      getTable() {
            const output = []
            for (let i = 0; i < this.#capacity; i++) {
                  if (this.#hashtable[i]) {
                        for (let j = 0; j < this.#hashtable[i].length; j++) {
                              output.push(this.#hashtable[i][j])
                        }
                  }
            }
            return output
      }
}
/**
 * @see https://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
 * @param {String} s 
 * @return {Number} hashcode
 */
function hash(s) {
      var hash = 0, strlen = s.length, i, c
      if (strlen === 0) {
            return hash
      }
      for (i = 0; i < strlen; i++) {
            c = s.charCodeAt(i)
            hash = (hash << 5) - hash + c
            hash = hash & hash // Convert to 32bit integer
      }
      return Math.abs(hash);
}
/**
 * Pairs up keys and values
 */
class KeyValuePair {
      /**
       * 
       * @param {String} key 
       * @param {*} value 
       */
      constructor(key, value) {
            this.key = key
            this.value = value
      }
}