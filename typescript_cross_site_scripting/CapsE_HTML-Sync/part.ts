/**
 * Created by Lars on 22.02.2016.
 */

/**
 * Created by Lars on 31.08.2015.
 */

declare var require;
declare var module;

interface UpdateData {
    style?: any;
    attributes?: any;
    data?: any;
    functions?: any;
    calls?:[any];
    roomId:string;
    id:string;
}

module.exports = function(HTMLSync){
    /**
     * Base Class for the synchronized working. Represents more or less a HTML-Tag.
     */
    class Part{
        id:string;
        name:string;
        static counter:number = 0;

        type:string;
        namespace:string;
        content:Part[] = [];
        style: any = {};
        attributes: any = {};
        data: any = {};
        functions: any = {};
        static includes: string[] = [];
        parent:Part;

        /**
         * Create either with just a type like "div" or with a hash-map with all relevant fields set.
         */
        constructor(type:string, json?:any){
            if(json){
                if(!json.id || json.id == ""){
                    var randLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
                    this.id = randLetter + Part.counter.toString() +  Date.now();
                    Part.counter++;
                }else{
                    this.id = json.id;
                }
                this.type = json.type;
                this.namespace = json.namespace;
                this.content = [];
                this.style = json.style;
                this.attributes = json.attributes;
                this.functions = json.functions;
                this.data = json.data;
                Part.includes = json.includes;

                for(var p in json.content){
                    this.addChild(new Part("", json.content[p]));
                }
            }else{
                var randLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
                this.id = randLetter + Part.counter.toString() +  Date.now();
                Part.counter++;
                this.type = type;
            }
            HTMLSync.add(this);
        }

        /**
         * Adds a Child-Part to this part. Also sets this Object as parent of the added child
         */
        addChild(obj:Part){
            obj.parent = this;
            this.content.push(obj);
        }

        css(attribute:string, value?:string){
            if(value){
                this.setStyle(attribute, value);
            }else{
                this.setStyles(attribute);
            }
        }

        private setStyle(attribute: string, value: string){
            this.style[attribute] = value;
        }

        private setStyles(style: any){
            for(var key in style){
                this.style[key] = style[key];
            }
        }

        attr(attribute:string, value?:string){
            if(value){
                this.setAttribute(attribute, value);
            }else{
                this.setAttributes(attribute);
            }
        }

        private setAttribute(attribute: string, value: string){
            this.attributes[attribute] = value;
        }

        private setAttributes(attribute: any){
            for(var key in attribute){
                this.attributes[key] = attribute[key];
            }
        }

        on(attribute: string, value: any){
            this.addEventHandler(attribute, value);
        }

        setEventHandler(attribute: string, value: any){
            this.functions[attribute] = this.prepareFunction(value);
        } //TODO: New Eventsystem

        addEventHandler(attribute: string, value: any){
            if(!this.functions[attribute]){
                this.functions[attribute] = [];
            }
            this.functions[attribute].push(this.prepareFunction(value));
        } //TODO: New Eventsystem

        addInclude(incl: string){
            Part.includes.push(incl);
        }

        /**
         * Prepares a function. All occurences of "this" will be replaced with parts[this.id] which accesses the same Object
         * as this would but makes sure that the object will be found at runtime.
         */
        prepareFunction(func){
            var f = func.toString();
            var m;
            while(m = /this/.exec(f)){
                f = f.replace(m, "HTMLSync.parts['" + this.id + "']");
            }

            return f;
        } //TODO: New Eventsystem

        /**
         * Finds the HTML-Element and applies all attributes, styles and functions again with the current state.
         */
        update(fields?:UpdateData){
            fields.id = this.id;
            HTMLSync.update(fields);
        }

        /**
         * Convertes this Object to a JSON which is ready to be synchronized with other clients.
         * @returns {{id: string, type: string, content: Array, style: any, attributes: any, functions: any}}
         */
        toJSON(){
            var json = {id: this.id, type: this.type, namespace: this.namespace, content: [], style: this.style, attributes: this.attributes, functions: this.functions, data: this.data, includes: Part.includes};
            for(var p in this.content){
                json.content.push(this.content[p].toJSON());
            }
            return json;
        }

        changeId(id:string, mainId?:string){
            var updated = false;
            if(!mainId){
                updated = true;
                mainId = this.id;
            }

            for(var c in this.content){
                c = this.content[c];
                var split = c.id.split("_");
                if(split[0] == mainId){
                    updated = true;
                    c.id = id + "_" + split[1];
                }
                c.changeId(id, mainId);
            }
            if(updated){
                for(var f in this.functions){
                    for(var x in this.functions[f]){
                        console.debug("Changing function " + x + " of all " + f + " functions for Object " + this.id);
                        console.debug("Replacing " + mainId + " with " + id);
                        var re = new RegExp(mainId, 'g');
                        this.functions[f][x] = this.functions[f][x].replace(re, id);
                    }
                }
            }

            if(this.id == mainId) this.id = id;
        }

    }

    return Part;
};