const db = require('./components/db');

async function run() {
  try {
    console.log("Adding books...");
    await db.Book.insert({
      title: "Hábitos Atómicos",
      author: "James Clear",
      category: "Desarrollo Personal",
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      image: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1653631557i/53051468.jpg",
      pages: "320",
      rating: 5,
      active: true,
      created_at: new Date()
    });
    
    await db.Book.insert({
      title: "Padre Rico Padre Pobre",
      author: "Robert T. Kiyosaki",
      category: "Educación Financiera",
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      image: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1388188158i/69571.jpg",
      pages: "336",
      rating: 5,
      active: true,
      created_at: new Date()
    });
    
    // Check if the categories exist, if not insert them too
    const cats = await db.BookCategory.find({});
    const catNames = cats.map(c => c.name);
    if (!catNames.includes("Desarrollo Personal")) {
      await db.BookCategory.insert({ name: "Desarrollo Personal" });
    }
    if (!catNames.includes("Educación Financiera")) {
      await db.BookCategory.insert({ name: "Educación Financiera" });
    }
    
    console.log("Books and categories added!");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
