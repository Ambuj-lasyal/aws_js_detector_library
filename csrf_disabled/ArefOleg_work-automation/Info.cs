using AboutEx;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
namespace work_automation.Pages;

public class InfoModel : PageModel
{   public string Message{get; set;}
    public string aboutService{get; set;}
    
    public void OnGet(string about)
    {       
       aboutService = about;
       if(about.Equals("ADM")){
          var task = Task.Run(async () => await AboutEx.About.getADMInfo());
          task.Wait();
          Message = task.Result;
       }else if(about.Equals("access")){
          var task = Task.Run(async () => await AboutEx.About.getEnviromentInfo());
          task.Wait();
          Message = task.Result;
       }else if(about.Equals("apply")){
          var task = Task.Run(async () => await AboutEx.About.getApplyInfo());
          task.Wait();
          Message = task.Result;  
       }else if(about.Equals("tns")){
          Message = AboutEx.About.tnsInfo(); 
       }
    }
    public void OnPost(){
        
    }
}
