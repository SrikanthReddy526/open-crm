package com.opencrm.customer;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class CustomerHelpersTest {

    @Test
    void likePatternEscapesWildcardsAndLowercases() {
        assertEquals("", CustomerService.likePattern("  "));
        assertEquals("%ravi%", CustomerService.likePattern(" Ravi "));
        assertEquals("%50!%!_off!!%", CustomerService.likePattern("50%_off!"));
        assertEquals("%రవి%", CustomerService.likePattern("రవి"));
    }

    @Test
    void parseSortOnlyAllowsWhitelistedFields() {
        assertEquals(Sort.by("city").descending(), CustomerService.parseSort("city,desc"));
        assertEquals(Sort.by("name").ascending(), CustomerService.parseSort("passwordHash,asc"));
        assertEquals(Sort.by("name"), CustomerService.parseSort(null));
    }

    @Test
    void csvExportGuardsAgainstFormulaInjectionButKeepsPhones() {
        assertEquals("'=HYPERLINK(\"x\")", CustomerCsvService.safe("=HYPERLINK(\"x\")"));
        assertEquals("'@SUM(A1)", CustomerCsvService.safe("@SUM(A1)"));
        assertEquals("+91 98765 43210", CustomerCsvService.safe("+91 98765 43210"));
        assertEquals("'-2+3+cmd", CustomerCsvService.safe("-2+3+cmd"));
        assertEquals("Ravi", CustomerCsvService.safe("Ravi"));
    }
}
