using ASP_P15.Data;
using ASP_P15.Data.Entities;
using ASP_P15.Models.Api;
using ASP_P15.Models.Cart;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ASP_P15.Controllers
{
    [Route("api/cart")]
    [ApiController]
    public class CartController(DataContext dataContext) : ControllerBase
    {
        private readonly DataContext _dataContext = dataContext;
        
        [HttpGet]
        public RestResponse<Cart?> DoGet([FromQuery] string id)
        {
            var response = new RestResponse<Cart?>
            {
                Meta = new MetaData
                {
                    Service = "Cart",
                    Timestamp = DateTime.Now.Ticks
                }
            };

            try
            {
                if (string.IsNullOrEmpty(id))
                {
                    response.Meta.CartProductId = null;
                    response.Meta.Count = null;
                    response.Data = null;
                    return response;
                }

                var cart = _dataContext
                    .Carts
                    .Include(c => c.CartProducts)
                    .ThenInclude(cp => cp.Product)
                    .FirstOrDefault(c => c.UserId.ToString() == id && c.CloseDt == null && c.DeleteDt == null);

                response.Data = cart;
                return response;
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message);

                response.Meta.CartProductId = null;
                response.Meta.Count = null;
                response.Data = null;
                return response;
            }
        }


        [HttpPost]
        public async Task<RestResponse<String>> DoPost([FromBody] CartFormModel formModel)
        {
            RestResponse<String> response = new()
            {
                Meta = new()
                {
                    Service = "Cart",
                },
            };

            if (formModel.UserId == default)
            {
                response.Data = "Error 401: Unauthorized";
                return response;
            }
            if (formModel.ProductId == default)
            {
                response.Data = "Error 422: Missing Product Id";
                return response;
            }
            if (formModel.Count <= 0)
            {
                response.Data = "Error 422: Positive Cnt expected";
                return response;
            }

            var cart = _dataContext
                .Carts
                .FirstOrDefault(c => c.UserId == formModel.UserId && c.CloseDt == null && c.DeleteDt == null);

            CartProduct cartProduct = null;

            if (cart == null)
            {
                Guid cartId = Guid.NewGuid();
                cart = new Cart
                {
                    Id = cartId,
                    UserId = formModel.UserId,
                    CreateDt = DateTime.Now,
                };
                _dataContext.Carts.Add(cart);

                cartProduct = new CartProduct
                {
                    Id = Guid.NewGuid(),
                    CartId = cartId,
                    ProductId = formModel.ProductId,
                    Count = formModel.Count,
                };
                _dataContext.CartProducts.Add(cartProduct);
            }
            else
            {
                cartProduct = _dataContext
                    .CartProducts
                    .FirstOrDefault(cp => cp.CartId == cart.Id && cp.ProductId == formModel.ProductId);

                if (cartProduct == null)
                {
                    cartProduct = new CartProduct
                    {
                        Id = Guid.NewGuid(),
                        CartId = cart.Id,
                        ProductId = formModel.ProductId,
                        Count = formModel.Count,
                    };
                    _dataContext.CartProducts.Add(cartProduct);
                }
                else
                {
                    cartProduct.Count += formModel.Count;
                }
            }

            await _dataContext.SaveChangesAsync();

            response.Data = "Added";
            response.Meta.Count = 1;
            response.Meta.CartProductId = cartProduct.Id.ToString();
            return response;
        }

        [HttpPut]
        public async Task<RestResponse<String>> DoPut(
            [FromQuery] Guid cpId, [FromQuery] int increment)
        {
            RestResponse<String> response = new()
            {
                Meta = new()
                {
                    Service = "Cart",
                },
            };
            Console.WriteLine($"Received cpId: {cpId}, increment: {increment}");
            if (cpId == default)
            {
                response.Data = "Error 400: cpId is not valid";
                return response;
            }
            if (increment == 0)
            {
                response.Data = "Error 400: increment is not valid";
                return response;
            }
            var cp = _dataContext
                .CartProducts
                .Include(cp => cp.Cart)
                .FirstOrDefault(cp => cp.Id == cpId);
            if (cp == null)
            {
                response.Data = "Error 404: cpId does not identify entity";
                return response;
            }
            if (cp.Cart.CloseDt is not null || cp.Cart.DeleteDt is not null)
            {
                response.Data = "Error 409: cpId identifies not active entity";
                return response;
            }
            if (cp.Count + increment < 0)
            {
                response.Data = "Error 422: increment could not be applied";
                return response;
            }

            if (cp.Count + increment == 0)
            {
                // віднімання усього -- видалення 
                _dataContext.CartProducts.Remove(cp);
                response.Meta.Count = 0;
            }
            else
            {
                // оновлення кількості
                cp.Count += increment;
                response.Meta.Count = cp.Count;
            }
            await _dataContext.SaveChangesAsync();
            response.Data = "Updated";
            response.Meta.CartProductId = cp.Id.ToString();
            return response;
        }

        [HttpDelete]
        public async Task<RestResponse<String>> DoDelete([FromQuery] Guid cartId)
        {
            RestResponse<String> response = new()
            {
                Meta = new()
                {
                    Service = "Cart",
                },
            };
            if (cartId == default)
            {
                response.Data = "Error 400: cartId is not valid";
                return response;
            }
            var cart = _dataContext
                .Carts
                .FirstOrDefault(c => c.Id == cartId);

            if (cart == null)
            {
                response.Data = "Error 404: cartId is not found";
                return response;
            }
            if (cart.CloseDt != null || cart.DeleteDt != null)
            {
                response.Data = "Error 409: cartId identify closed or deleted cart";
                return response;
            }
            cart.CloseDt = DateTime.Now;
            await _dataContext.SaveChangesAsync();
            response.Data = "Deleted";
            return response;
        }
    }
}
