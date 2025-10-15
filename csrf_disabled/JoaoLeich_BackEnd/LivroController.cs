using BackEnd.DTO.Input;
using BackEnd.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;


namespace BackEnd.Controller
{
    public class LivroController : ControllerBase
    {

        private readonly ILivroService _service;

        public LivroController(ILivroService service)
        {
            _service = service;
        }

        [HttpGet]
        [Route("/livros")]
        public async Task<ActionResult<List<LivroOutput>>> GetAllLivros()
        {

            var livros = await this._service.GetAllLivros();

            if (livros == null || livros.Count.Equals(0))
            {
                return NoContent();
            }

            var livrosOutput = livros.Select(l => new LivroOutput
            {
                id = l.id,
                nome = l.nome,
                categoria = l.categoria,
                dataPublicacao = l.dataPublicacao

            }).ToList();

            return Ok(livrosOutput);

        }

        [HttpGet]
        [Route("livros/{id}")]
        public async Task<ActionResult<LivroOutput>> GetLivroById(int id)
        {

            var livro = await this._service.GetLivroById(id);

            if (livro == null)
            {
                return NotFound("Livro Com O Id Informado Não Foi Encontrado");
            }

            var livroOutput = new LivroOutput
            {
                id = livro.id,
                nome = livro.nome,
                categoria = livro.categoria,
                dataPublicacao = livro.dataPublicacao
            };

            return Ok(livroOutput);

        }

        [HttpPost]
        [Route("livros")]
        public async Task<ActionResult<LivroOutput>> AddLivroAsync([FromBody] LivroInput livro)
        {

            if (livro == null)
            {
                return BadRequest("O Livro Não Pode Ser Nulo");
            }

            try
            {
                var newLivro = new Livro
                {
                    nome = livro.nome,
                    categoria = livro.categoria,
                    dataPublicacao = livro.dataPublicacao
                };

                await this._service.AddLivroAsync(newLivro);

                var livroOutput = new LivroOutput
                {
                    id = newLivro.id,
                    nome = newLivro.nome,
                    categoria = newLivro.categoria,
                    dataPublicacao = newLivro.dataPublicacao
                };

                return Ok(livroOutput);
            }
            catch (Exception ex)
            {
                return BadRequest($"Erro: {ex.Message}");
            }
        }

        [HttpDelete]
        [Route("livros/{id}")]
        public async Task<ActionResult> DeleteLivro(int id)
        {

            var livro = await this._service.GetLivroById(id);

            if (livro == null)
            {
                return NotFound("O Livro Informado Não Foi Encontrado");
            }

            await this._service.DeleteLivroAsync(id);

            return NoContent();

        }

        [HttpPut]
        [Route("livros/{id}")]
        public async Task<ActionResult<LivroOutput>> UpdateLivro(int id,[FromBody] LivroInput newLivro)
        {

            if (newLivro == null)
            {
                return BadRequest("O Livro Não Pode Ser Nulo");
            }
            try
            {

                var livroBase = this._service.GetLivroById(id).Result;

                if (livroBase == null) 
                {
                    return NotFound("Livro Com O Id Informado Não Encontrado!");
                }

                livroBase.nome = newLivro.nome;
                livroBase.categoria = newLivro.categoria;
                livroBase.dataPublicacao = newLivro.dataPublicacao;

                await this._service.UpdateLivroAsync(livroBase);

                var livroOutput = new LivroOutput
                {
                    id = livroBase.id,
                    nome = livroBase.nome,
                    categoria = livroBase.categoria,
                    dataPublicacao = livroBase.dataPublicacao
                };

                return Ok(livroOutput);
            }
            catch (Exception ex)
            {
                return BadRequest($"Erro: {ex.Message}");
            }
        }
    }
}
