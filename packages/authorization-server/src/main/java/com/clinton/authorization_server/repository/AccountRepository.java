package com.clinton.authorization_server.repository;

import com.clinton.authorization_server.model.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * @author Clinton Fernandes
 */
@Repository
public interface AccountRepository extends JpaRepository<Account, Integer> {
}
