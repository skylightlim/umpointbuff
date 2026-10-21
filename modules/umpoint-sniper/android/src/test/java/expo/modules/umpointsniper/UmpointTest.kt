package expo.modules.umpointsniper

import expo.modules.umpointsniper.Grid.State
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

class UmpointTest {
  private fun fixture(name: String) = javaClass.classLoader!!.getResource(name)!!.readText()

  private fun task(date: String, start: String, end: String) = Task(
    id = "t", date = date, start = start, end = end, court = "1", anyCourt = false, event = "capture only",
    pax = 1, dryRun = false, measure = false, fireAt = 0, createdAt = 0,
  )

  @Test
  fun parsesTheSyntheticGrid() {
    val g = Grid.parse(fixture("grid_synthetic.html"))
    assertEquals(listOf("26-10-2026", "27-10-2026", "28-10-2026", "29-10-2026", "30-10-2026", "31-10-2026", "01-11-2026"), g.dates)
    assertEquals(listOf("09:00", "09:30", "12:00", "12:30"), g.rows.map { it.start })
    assertEquals("me@siswa.um.edu.my", g.person)
    assertEquals("25-10-2026", g.initdate)
    assertEquals(State.FREE, g.cell("26-10-2026", "09:00")!!.state)
    // A two-row booking covers 09:30 too, and doesn't shift Wednesday's cells left.
    assertEquals(listOf(State.TAKEN, State.TAKEN), g.states("27-10-2026", "09:00", "10:00"))
    assertEquals(State.FREE, g.cell("28-10-2026", "09:30")!!.state)
    assertEquals(State.MINE, g.cell("28-10-2026", "12:00")!!.state)
    assertEquals(State.CLOSED, g.cell("31-10-2026", "09:00")!!.state)
    assertNull(g.states("26-10-2026", "17:00", "17:30"))
  }

  @Test
  fun builtCellIdsMatchUmpointsIds() {
    val g = Grid.parse(fixture("grid_synthetic.html"))
    for ((i, row) in g.rows.withIndex()) for ((c, cell) in row.cells.withIndex()) {
      if (cell.state == State.FREE) assertEquals(cell.id, Umpoint.cellId(g.dates[c], g.rows[i].start))
    }
    assertEquals("26-10-2026/17:00/17:30/05:00 PM/05:30 pm", Umpoint.cellId("26-10-2026", "17:00"))
    assertEquals("26-10-2026/12:30/13:00/12:30 PM/01:00 pm", Umpoint.cellId("26-10-2026", "12:30"))
  }

  @Test
  fun rolloverIsMondayMidnightMyt() {
    assertEquals(1792944000000L, Umpoint.rolloverFor("28-10-2026")) // Mon 26 Oct 00:00 +08
    assertEquals(1792944000000L, Umpoint.rolloverFor("26-10-2026"))
    assertEquals(1792944000000L, Umpoint.rolloverFor("01-11-2026"))
    assertEquals("26-10-2026", Umpoint.mytDate(1792944000000L))
    assertEquals("25-10-2026", Umpoint.mytDate(1792944000000L - 1))
  }

  /** Same fields, order and values as UMPoint's own form sent on 22 Oct 2026 (captured, never sent). */
  @Test
  fun bookingFieldsMatchTheBrowserForm() {
    val f = Umpoint.bookingFields(task("24-10-2026", "17:00", "17:30"), "1", 1792339200L, "22-10-2026")
    assertEquals(
      listOf(
        "sdbook", "stbook", "edbook", "etbook", "event", "pax", "ritem[]", "has-required",
        "doc-1", "doc-type-1", "doc-2", "doc-type-2", "doc-3", "doc-type-3", "doc-4", "doc-type-4", "doc-5", "doc-type-5",
        "term", "has_upfile", "act", "doproc", "ptj", "dep", "spid", "curmonth", "curyear", "srchtype", "theday",
        "calflag", "lweek", "tweek", "nweek", "inputo", "initdate", "recnum", "stdateselected", "eddateselected",
      ),
      f.map { it.first },
    )
    val m = f.toMap()
    assertEquals("approval", m["doc-type-1"])
    assertNull(m["doc-1"])
    assertEquals("21201", m["spid"])
    assertEquals("1791734400", m["lweek"])
    assertEquals("1792339200", m["tweek"])
    assertEquals("1792944000", m["nweek"])
    assertEquals("24-10-2026/17:00/17:30/05:00 PM/05:30 pm", m["stdateselected"])
    assertEquals("24-10-2026/17:00/17:30/05:00 PM/05:30 pm", m["eddateselected"])
    val two = Umpoint.bookingFields(task("27-10-2026", "17:00", "19:00"), "2", 1792944000L, "26-10-2026").toMap()
    assertEquals("27-10-2026/18:30/19:00/06:30 PM/07:00 pm", two["eddateselected"])
    assertEquals("21199", two["spid"])
  }

  @Test
  fun multipartHasEmptyFileParts() {
    val body = String(Umpoint.multipart(listOf("a" to "1", "doc-1" to null), "B"))
    assertEquals(
      "--B\r\nContent-Disposition: form-data; name=\"a\"\r\n\r\n1\r\n" +
        "--B\r\nContent-Disposition: form-data; name=\"doc-1\"; filename=\"\"\r\nContent-Type: application/octet-stream\r\n\r\n\r\n" +
        "--B--\r\n",
      body,
    )
  }

  /** Optional: real pages captured locally (never committed). Set UMPOINT_PAGES to their folder. */
  @Test
  fun realPagesParse() {
    val dir = System.getenv("UMPOINT_PAGES")?.let(::File)
    assumeTrue(dir != null && File(dir, "grid_this.html").exists())
    for (name in listOf("grid_this.html", "grid_next.html")) {
      val g = Grid.parse(File(dir, name).readText())
      assertEquals(7, g.dates.size)
      assertEquals(21, g.rows.size)
      var free = 0
      for ((i, row) in g.rows.withIndex()) for ((c, cell) in row.cells.withIndex()) {
        if (cell.state == State.FREE) {
          free++
          assertEquals(cell.id, Umpoint.cellId(g.dates[c], g.rows[i].start))
        }
        if (c >= 5) assertEquals(State.CLOSED, cell.state)
      }
      println("$name: ${g.dates.first()}..${g.dates.last()}, $free free, person set=${g.person != null}, initdate=${g.initdate}")
    }
  }
}
