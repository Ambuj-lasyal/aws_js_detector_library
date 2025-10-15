using Microsoft.AspNetCore.Mvc;
using ToDoList.Models;
using System.Collections.Generic;
using System.Linq;

namespace ToDoList.Controllers
{
    public class ToDoController : Controller
    {
        // In-memory list for demo purposes
        private static List<ToDoItem> _toDoItems = new List<ToDoItem>();
        private static int _nextId = 1;

        public IActionResult Index()
        {
            return View(_toDoItems);
        }

        [HttpPost]
        public IActionResult Add(string task)
        {
            if (!string.IsNullOrEmpty(task))
            {
                _toDoItems.Add(new ToDoItem
                {
                    Id = _nextId++,
                    Task = task,
                    IsCompleted = false
                });
            }
            return RedirectToAction("Index");
        }

        [HttpPost]
        public IActionResult ToggleCompletion(int id)
        {
            var item = _toDoItems.FirstOrDefault(x => x.Id == id);
            if (item != null)
            {
                item.IsCompleted = !item.IsCompleted;
            }
            return RedirectToAction("Index");
        }

        [HttpPost]
        public IActionResult Delete(int id)
        {
            var item = _toDoItems.FirstOrDefault(x => x.Id == id);
            if (item != null)
            {
                _toDoItems.Remove(item);
            }
            return RedirectToAction("Index");
        }
    }
}