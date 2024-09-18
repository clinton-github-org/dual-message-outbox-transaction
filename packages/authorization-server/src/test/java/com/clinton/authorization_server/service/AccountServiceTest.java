package com.clinton.authorization_server.service;

import com.clinton.authorization_server.model.Account;
import com.clinton.authorization_server.repository.AccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

/**
 * @author Clinton Fernandes
 */

@ExtendWith(MockitoExtension.class)
class AccountServiceTest {

    @Mock
    AccountRepository accountRepository;

    private AccountService accountService;
    private Account account;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);

        account = new Account(1, "test", "savings", new BigDecimal("100"));

        accountService = new AccountService(accountRepository);
    }

    @Test
    public void createAccountTest() {
        when(accountRepository.save(account)).thenReturn(account);

        accountService.createAccount(account);

//        assertEquals(result.getBody().get("Success"), "Account created with account number: 1");
//        assertEquals(201, result.getStatusCode().value());
//
//        verify(accountRepository, times(1)).save(any(Account.class));
    }
}
