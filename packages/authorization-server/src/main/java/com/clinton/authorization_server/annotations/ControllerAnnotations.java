package com.clinton.authorization_server.annotations;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * @author Clinton Fernandes
 */
public class ControllerAnnotations {

    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @Operation(summary = "authorize payment", description = "authorizes a transaction between 2 parties")
    @ApiResponses(value = {@ApiResponse(responseCode = "200", description = "Successful Operation"), @ApiResponse(responseCode = "500", description = "Internal Server Error")})
    public @interface AuthorizeTransactionDoc {
    }

    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @Operation(summary = "credit account", description = "credits money in an account")
    @ApiResponses(value = {@ApiResponse(responseCode = "204", description = "Successful Operation"), @ApiResponse(responseCode = "500", description = "Internal Server Error")})
    public @interface CreditAccountDoc {
    }

    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @Operation(summary = "debit account", description = "debits money from an account")
    @ApiResponses(value = {@ApiResponse(responseCode = "204", description = "Successful Operation"), @ApiResponse(responseCode = "500", description = "Internal Server Error")})
    public @interface DebitAccountDoc {
    }

    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @Operation(summary = "Account Creation", description = "Creates a new account with unique account ID")
    @ApiResponses(value = {@ApiResponse(responseCode = "201", description = "Successful Creation"), @ApiResponse(responseCode = "500", description = "Internal Server Error")})
    public @interface AddAccountDoc {
    }

    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @Operation(summary = "deletes an account", description = "deletes an account")
    @ApiResponses(value = {@ApiResponse(responseCode = "204", description = "Successful Operation"), @ApiResponse(responseCode = "500", description = "Internal Server Error")})
    public @interface DeleteAccountDoc {
    }
}
