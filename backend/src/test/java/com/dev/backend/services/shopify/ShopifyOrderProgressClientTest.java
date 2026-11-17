package com.dev.backend.services.shopify;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class ShopifyOrderProgressClientTest {
    private static final String DOMAIN = "fcentric-test.myshopify.com";
    private static final String URL = "https://" + DOMAIN + "/admin/api/2026-04/graphql.json";
    private static final String FO = "gid://shopify/FulfillmentOrder/11";
    private final ObjectMapper mapper = new ObjectMapper();
    private MockRestServiceServer server;
    private ShopifyOrderProgressClient client;

    @BeforeEach
    void setUp() {
        RestTemplate rest = new RestTemplate();
        server = MockRestServiceServer.bindTo(rest).build();
        client = new ShopifyOrderProgressClient(rest, mapper);
    }

    private Map<String, Object> fo(String id, String status, boolean supportsProgress) {
        return Map.of("id", id, "status", status, "supportedActions",
                supportsProgress ? List.of(Map.of("action", "REPORT_PROGRESS")) : List.of());
    }

    private void query(List<Map<String, Object>> nodes, boolean hasNextPage, String cursor) throws Exception {
        server.expect(requestTo(URL)).andExpect(method(HttpMethod.POST))
                .andExpect(header("X-Shopify-Access-Token", "test-key"))
                .andExpect(jsonPath("$.variables.id").value("gid://shopify/Order/123"))
                .andRespond(withSuccess(mapper.writeValueAsString(Map.of("data", Map.of("order",
                        Map.of("fulfillmentOrders", Map.of("nodes", nodes, "pageInfo",
                                Map.of("hasNextPage", hasNextPage, "endCursor", cursor)))))), MediaType.APPLICATION_JSON));
    }

    private void mutation(String response) {
        server.expect(requestTo(URL)).andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.variables.id").value(FO))
                .andExpect(jsonPath("$.variables.progressReport.reasonNotes").isString())
                .andExpect(request -> {
                    var body = mapper.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    assertTrue(body.path("query").asText().contains("$progressReport: FulfillmentOrderReportProgressInput"));
                    assertFalse(body.path("variables").path("progressReport").has("notes"));
                })
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
    }

    private String progress(String status) throws Exception {
        return mapper.writeValueAsString(Map.of("data", Map.of("fulfillmentOrderReportProgress",
                Map.of("fulfillmentOrder", Map.of("id", FO, "status", status), "userErrors", List.of()))));
    }

    @Test
    void changesRealStateUsingSupportedVersionAndReasonNotes() throws Exception {
        query(List.of(fo(FO, "OPEN", true)), false, "");
        mutation(progress("IN_PROGRESS"));
        assertTrue(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @Test
    void acceptsOrderGidAndDoesNotRepostAlreadyInProgress() throws Exception {
        query(List.of(fo(FO, "IN_PROGRESS", false)), false, "");
        assertTrue(client.reportProgress(DOMAIN, "test-key", "gid://shopify/Order/123"));
        server.verify();
    }

    @Test
    void graphqlSchemaErrorWithHttp200IsFailure() throws Exception {
        query(List.of(fo(FO, "OPEN", true)), false, "");
        mutation("{\"errors\":[{\"message\":\"Field notes is not defined\"}]}");
        assertFalse(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @Test
    void userErrorsWithHttp200AreFailureRegardlessOfJsonWhitespace() throws Exception {
        query(List.of(fo(FO, "OPEN", true)), false, "");
        mutation("""
                {"data":{"fulfillmentOrderReportProgress":{
                  "fulfillmentOrder":null,
                  "userErrors": [ {"code":"FULFILLMENT_ORDER_UNSUPPORTED_ACTION","message":"Denied"} ]
                }}}
                """);
        assertFalse(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @Test
    void noOrdersIsNotSuccess() throws Exception {
        query(List.of(), false, "");
        assertFalse(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @Test
    void doesNotPretendClosedOrderIsInProgress() throws Exception {
        query(List.of(fo(FO, "CLOSED", false)), false, "");
        assertFalse(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @Test
    void missingPermissionOrUnsupportedActionDoesNotCall3plAcceptOrFulfill() throws Exception {
        query(List.of(fo(FO, "OPEN", false)), false, "");
        assertFalse(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @Test
    void heldOrderCannotBeReportedAsSuccess() throws Exception {
        query(List.of(fo(FO, "ON_HOLD", false)), false, "");
        assertFalse(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"OPEN", "CLOSED", ""})
    void mutationMustConfirmInProgress(String returnedState) throws Exception {
        query(List.of(fo(FO, "OPEN", true)), false, "");
        mutation(progress(returnedState));
        assertFalse(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @Test
    void partialSuccessAcrossLocationsIsNotWholeOrderSuccess() throws Exception {
        query(List.of(fo(FO, "OPEN", true), fo("gid://shopify/FulfillmentOrder/22", "OPEN", false)), false, "");
        mutation(progress("IN_PROGRESS"));
        assertFalse(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @Test
    void readsAllPagesBeforeClaimingSuccess() throws Exception {
        query(List.of(fo(FO, "IN_PROGRESS", false)), true, "cursor-1");
        query(List.of(fo("gid://shopify/FulfillmentOrder/22", "OPEN", false)), false, "");
        assertFalse(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @Test
    void invalidPaginationFailsWithoutLooping() throws Exception {
        query(List.of(fo(FO, "IN_PROGRESS", false)), true, "");
        assertFalse(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(ints = {401, 403, 429, 500})
    void httpFailureCannotBecomeSuccess(int code) {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.valueOf(code)));
        assertFalse(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"data\":{\"order\":null}}", "{\"errors\":[{\"message\":\"Access denied\"}]}", "{}", "not json"})
    void invalidOrDeniedQueryCannotBecomeSuccess(String body) {
        server.expect(requestTo(URL)).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
        assertFalse(client.reportProgress(DOMAIN, "test-key", "123"));
        server.verify();
    }

    @Test
    void validatesInputsBeforeNetwork() {
        assertFalse(client.reportProgress(DOMAIN, "test-key", "SKU-123"));
        assertFalse(client.reportProgress(DOMAIN, "", "123"));
        assertFalse(client.reportProgress("attacker.example", "test-key", "123"));
        server.verify();
    }
}
