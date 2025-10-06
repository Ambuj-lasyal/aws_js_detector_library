const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const db = require("./config");

const app = express();
const port = 4000;

app.use(cors());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST","POST", "DELETE"],
  })
);

app.use(bodyParser.json());

function updateQuantity(type, price, qty) {
  const selectQuery = `SELECT * FROM pendingordertable WHERE ${type}_price = ?`;
  db.query(selectQuery, [price], (error, results) => {
    if (error) return res.status(500).send("Database error");

    if (results.length > 0) {
      const updateQuery = `UPDATE pendingordertable SET ${type}_qty = ? WHERE id = ?`;
      const newQty = parseInt(results[0][`${type}_qty`]) + parseInt(qty);
      db.query(updateQuery, [newQty, results[0].id], (error) => {
        if (error) return res.status(500).send(`Error updating ${type} order`);
        return true;
      });
    } else {
      return false;
    }
  });
}

//API end point for place order
app.post("/order", (req, res) => {
  const { buyerQty, buyerPrice, sellerQty, sellerPrice } = req.body;
  if (req.body == {}) {
    return res.status(301).json({ message: "body is empty" });
  }

  // Update buyer quantity if price matches
  const selectBuyerQuery = `SELECT * FROM pendingordertable WHERE buyer_price = ?`;
  db.query(selectBuyerQuery, [buyerPrice], (error, buyerResults) => {
    if (error) return res.status(500).send("Database error");

    if (buyerResults.length > 0) {
      const updateBuyerQuery = `UPDATE pendingordertable SET buyer_qty = ? WHERE id = ?`;
      const newBuyerQty =
        parseInt(buyerResults[0].buyer_qty) + parseInt(buyerQty);
      db.query(updateBuyerQuery, [newBuyerQty, buyerResults[0].id], (error) => {
        if (error) return res.status(500).send("Error updating buyer order");
      });
    } else {
      // Update seller quantity if price matches
      const selectSellerQuery = `SELECT * FROM pendingordertable WHERE seller_price = ?`;
      db.query(selectSellerQuery, [sellerPrice], (error, sellerResults) => {
        if (error) return res.status(500).send("Database error");

        if (sellerResults.length > 0) {
          const updateSellerQuery = `UPDATE pendingordertable SET seller_qty = ? WHERE id = ?`;
          const newSellerQty =
            parseInt(sellerResults[0].seller_qty) + parseInt(sellerQty);
          db.query(
            updateSellerQuery,
            [newSellerQty, sellerResults[0].id],
            (error) => {
              if (error)
                return res.status(500).send("Error updating seller order");
            }
          );
        } else {
          insertOrder(
            buyerQty ? parseInt(buyerQty) : null,
            buyerPrice ? parseInt(buyerPrice) : null,
            sellerQty ? parseInt(sellerQty) : null,
            sellerPrice ? parseInt(sellerPrice) : null
          );
        }
      });
    }
  });
  res.status(200).json({ message: "Order processed successfully!" });
});

function insertOrder(buyerQty, buyerPrice, sellerQty, sellerPrice) {
  const insertQuery = `INSERT INTO pendingordertable (buyer_qty, buyer_price, seller_qty, seller_price) VALUES (?, ?, ?, ?)`;
  db.query(
    insertQuery,
    [buyerQty, buyerPrice, sellerQty, sellerPrice],
    (error) => {
      if (error) console.error("Error inserting new order:", error);
      matchOrders();
      deleteNulls();
    }
  );
}

function deleteNulls() {
  db.query(
    `DELETE FROM pendingordertable WHERE buyer_qty IS NULL AND buyer_price IS NULL AND seller_qty IS NULL AND seller_price IS NULL;`,
    (error) => {
      if (error) console.error("Error deleting null values:", error);
      else console.log("Deleted null values.");
    }
  );
}

function matchOrders() {
  const matchQuery = `
    SELECT t1.id AS buyer_id, t1.buyer_price, t1.buyer_qty, 
           t2.id AS seller_id, t2.seller_price, t2.seller_qty 
    FROM pendingordertable t1
    JOIN pendingordertable t2 ON t1.buyer_price = t2.seller_price
    ORDER BY t1.buyer_price DESC`;

  db.query(matchQuery, (error, orders) => {
    if (error) return console.error("Error matching orders:", error);

    orders.forEach((order) => {
      const matchedQty = Math.min(order.buyer_qty, order.seller_qty);

      if (matchedQty > 0) {
        const completeQuery = `INSERT INTO completedordertable (price, qty) VALUES (?, ?)`;
        db.query(completeQuery, [order.buyer_price, matchedQty]);

        updateOrClearOrder(
          "buyer",
          order.buyer_qty - matchedQty,
          order.buyer_id,
          order.buyer_price
        );
        updateOrClearOrder(
          "seller",
          order.seller_qty - matchedQty,
          order.seller_id,
          order.seller_price
        );
      }
    });
  });
}

function updateOrClearOrder(type, qtyLeft, id, price) {
  const clearQuery = `UPDATE pendingordertable SET ${type}_qty = ?, ${type}_price = ? WHERE id = ?`;
  const newQty = qtyLeft > 0 ? qtyLeft : null;
  db.query(clearQuery, [newQty, newQty ? price : null, id], (error) => {
    if (error) console.error(`Error updating ${type} order:`, error);
  });
}

//API end point for get all completed orders
app.get("/orders", (req, res) => {
  const pendingBuyerQuery = `
      SELECT id, buyer_price, buyer_qty 
      FROM pendingordertable 
      WHERE buyer_price IS NOT NULL AND buyer_qty IS NOT NULL order by id;
    `;

  const pendingSellerQuery = `
      SELECT id, seller_price, seller_qty 
      FROM pendingordertable 
      WHERE seller_price IS NOT NULL AND seller_qty IS NOT NULL order by id;
    `;

  const completedQuery = `SELECT * FROM completedordertable;`;

  db.query(pendingBuyerQuery, (error, pendingBuyerOrders) => {
    if (error) {
      console.error("Error fetching pending buyer orders", error);
      return res.status(500).send("Error fetching pending buyer orders");
    }

    db.query(pendingSellerQuery, (error, pendingSellerOrders) => {
      if (error) {
        console.error("Error fetching pending seller orders", error);
        return res.status(500).send("Error fetching pending seller orders");
      }

      db.query(completedQuery, (error, completedOrders) => {
        if (error) {
          console.error("Error fetching completed orders", error);
          return res.status(500).send("Error fetching completed orders");
        }

        res
          .status(200)
          .json({ pendingBuyerOrders, pendingSellerOrders, completedOrders });
      });
    });
  });
});

//api end point for delete completed order item
app.delete("/completed_orders/:id", (req, res) => {
  const deleteSqlQuery = `delete from completedordertable where id = ?;`;
  const { id } = req.params;
  db.query(deleteSqlQuery, [id], (error, result) => {
    if (error) res.status(500).send(error);
    res.status(200).json({ message: result });
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}...!`);
});
