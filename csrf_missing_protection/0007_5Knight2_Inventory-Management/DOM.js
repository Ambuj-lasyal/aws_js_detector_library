let ul=document.querySelector('#ul');
let form=document.querySelector('#InventoryForm');
let base_URL="https://crudcrud.com/api/200903f4fd9a4d6c8f4a5853fe250ccd/appointments";

showall();
function showall(){
axios.get(base_URL)
.then((res)=>{
    for(let i=0;i<res.data.length;i++){
        show(res.data[i]);
    }
})
.catch((err)=>{
    console.log(err)
})}

form.addEventListener('submit',add);
ul.addEventListener('click',buy);



function add(e){
e.preventDefault();

let myobj={
    ItemName:document.querySelector('#Item_Name').value,
    Description:document.querySelector('#Description').value,
    Price:document.querySelector('#Price').value,
    Quantity:document.querySelector('#Quantity').value
}
axios.post(base_URL,myobj)
.then((myobj2)=>{
    console.log(myobj2.data);
   show(myobj2.data);

})
.catch((err)=>{console.log(err)})
}

function buy(e){
    e.preventDefault();
    let classes=e.target.classList;
    let val=0;
    if(classes[0]=='buy1'){
        val=1;
    }else if(classes[0]=='buy2'){
        val=2;
    }else if(classes[0]=='buy3'){
        val=3;
    }
    if(val!=0){
        axios.get(base_URL+"/"+e.target.parentElement.id)
        .then((myobj1)=>{
            myobj1.data.Quantity=myobj1.data.Quantity-val;
            delete myobj1.data._id;
            axios.put(base_URL+"/"+e.target.parentElement.id,myobj1.data)
            .then((res)=>{
                
                    while (ul.firstChild) {
                        ul.removeChild(ul.firstChild);
                    }
                
                showall();
            })
            .catch((err)=>{
                console.log(err)
            });
        })
    }
}

function show(myobj){
    
    let li=document.createElement('li');
    li.id=myobj._id;
 
    li.appendChild(document.createTextNode(myobj.ItemName+'-'+myobj.Description+'-'+myobj.Price+'-'+myobj.Quantity));
    let b1=document.createElement('button');
  
    b1.classList.add('buy1');
    b1.appendChild(document.createTextNode('buy1'));
    b1.style.backgroundColor='gray';
    li.appendChild(b1);

    let b2=document.createElement('button');
    b2.appendChild(document.createTextNode('buy2'));
    b2.classList.add('buy2');
    b2.style.backgroundColor='gray';
    li.appendChild(b2);

    let b3=document.createElement('button');
    b3.appendChild(document.createTextNode('buy3'));
    b3.classList.add('buy2');
    b3.style.backgroundColor='gray';
    li.appendChild(b3);

    ul.appendChild(li);

}