using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using bVue.code.Backend.repo;
using System.Collections.Generic;
using System.Text;
using bvue.code.Backend;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;

using System.Linq;
using System.Net;
//using System.Web.Http;

namespace bVue.code
{
    public class DbManager
    {
        public static LiteRepo Instance =  new LiteRepo(); //{ get; private set; }
  
    }

    public class bHub : Controller//Hub
    {
        public  LiteRepo repo { get { return DbManager.Instance; } }
       
       
        public async Task<List<Post>> GetPosts(string search, string orderby, int page, int pagesize)
        {
           // int c = 0;
            List<Post> q ;
            if(!string.IsNullOrEmpty(search))
            {
                if(isNumber(search))
                {
                      q = await repo.GetQuery<Post>(p => p.ID == int.Parse(search),
                      orderby, page, pagesize);
                       return q;  
                }
             q = await repo.GetQuery<Post>(p => p.Title.Contains(search) 
             || p.Content.Contains(search),orderby, page, pagesize);
             return q;
            }
            q = await repo.GetQuery<Post>(p => p.ID>0, orderby, page, pagesize);
            
            return q;          
        }

        bool isNumber(string s)
        {
             var isNumber = new Regex(@"^\d+$");
           return  isNumber.IsMatch(s);
        }

        [HttpPost]
        public int InsertPost([FromBody] Post p)
        {
           // return await Task.Run(() => {
                return repo.Insert<Post>(p);
          //  });
        
        }
        
        [HttpPost]
        public async Task<bool>  UpdatePost(Post p)
        {
            return await repo.Update<Post>(p);
        }
        public async Task<int>  DeletePost(int id)
        {
            return await repo.Delete<Post>(p=>p.ID==id);
        }
     


        // public string ReturnSome()
        // {
        //     return  "abcd";
        // }
        // protected object GetAuthInfo()
        // {
        //     var user = Context.User;
        //     return new
        //     {
        //         IsAuthenticated = user.Identity.IsAuthenticated,
        //         IsAdmin = user.IsInRole("Admin"),
        //         UserName = user.Identity.Name
        //     };
        // }
    } 
   
}