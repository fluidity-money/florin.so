package yearn

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/fluidity-money/florin.so/lib/types/events"
	"github.com/lib/pq"
)

type Deposit struct {
	events.Event
	Sender events.Address `json:"sender"`
	Owner  events.Address `json:"owner"`
	Assets events.Number  `json:"assets"`
	Shares events.Number  `json:"shares"`
}

func (Deposit) TableName() string { return "yearn_events_deposit" }

type Withdraw struct {
	events.Event
	Sender   events.Address `json:"sender"`
	Receiver events.Address `json:"receiver"`
	Owner    events.Address `json:"owner"`
	Assets   events.Number  `json:"assets"`
	Shares   events.Number  `json:"shares"`
}

func (Withdraw) TableName() string { return "yearn_events_withdraw" }

type Transfer struct {
	events.Event
	Sender   events.Address `json:"sender"`
	Receiver events.Address `json:"receiver"`
	Value    events.Number  `json:"value"`
}

func (Transfer) TableName() string { return "yearn_events_transfer" }

type Approval struct {
	events.Event
	Owner   events.Address `json:"owner"`
	Spender events.Address `json:"spender"`
	Value   events.Number  `json:"value"`
}

func (Approval) TableName() string { return "yearn_events_approval" }

type StrategyChanged struct {
	events.Event
	Strategy   events.Address `json:"strategy"`
	ChangeType events.Number  `json:"change_type"`
}

func (StrategyChanged) TableName() string { return "yearn_events_strategy_changed" }

type StrategyReported struct {
	events.Event
	Strategy     events.Address `json:"strategy"`
	Gain         events.Number  `json:"gain"`
	Loss         events.Number  `json:"loss"`
	CurrentDebt  events.Number  `json:"current_debt"`
	ProtocolFees events.Number  `json:"protocol_fees"`
	TotalFees    events.Number  `json:"total_fees"`
	TotalRefunds events.Number  `json:"total_refunds"`
}

func (StrategyReported) TableName() string { return "yearn_events_strategy_reported" }

type DebtUpdated struct {
	events.Event
	Strategy    events.Address `json:"strategy"`
	CurrentDebt events.Number  `json:"current_debt"`
	NewDebt     events.Number  `json:"new_debt"`
}

func (DebtUpdated) TableName() string { return "yearn_events_debt_updated" }

type RoleSet struct {
	events.Event
	Account events.Address `json:"account"`
	Role    events.Number  `json:"role"`
}

func (RoleSet) TableName() string { return "yearn_events_role_set" }

type UpdateFutureRoleManager struct {
	events.Event
	FutureRoleManager events.Address `json:"future_role_manager"`
}

func (UpdateFutureRoleManager) TableName() string { return "yearn_events_update_future_role_manager" }

type UpdateRoleManager struct {
	events.Event
	RoleManager events.Address `json:"role_manager"`
}

func (UpdateRoleManager) TableName() string { return "yearn_events_update_role_manager" }

type UpdateAccountant struct {
	events.Event
	Accountant events.Address `json:"accountant"`
}

func (UpdateAccountant) TableName() string { return "yearn_events_update_accountant" }

type UpdateDepositHook struct {
	events.Event
	DepositHook events.Address `json:"deposit_hook"`
}

func (UpdateDepositHook) TableName() string { return "yearn_events_update_deposit_hook" }

type UpdateWithdrawHook struct {
	events.Event
	WithdrawHook events.Address `json:"withdraw_hook"`
}

func (UpdateWithdrawHook) TableName() string { return "yearn_events_update_withdraw_hook" }

type UpdateTransferHook struct {
	events.Event
	TransferHook events.Address `json:"transfer_hook"`
}

func (UpdateTransferHook) TableName() string { return "yearn_events_update_transfer_hook" }

type UpdateDefaultQueue struct {
	events.Event
	NewDefaultQueue pq.StringArray `json:"new_default_queue" gorm:"type:address[]"`
}

func (UpdateDefaultQueue) TableName() string { return "yearn_events_update_default_queue" }

type UpdateUseDefaultQueue struct {
	events.Event
	UseDefaultQueue bool `json:"use_default_queue"`
}

func (UpdateUseDefaultQueue) TableName() string { return "yearn_events_update_use_default_queue" }

type UpdateAutoAllocate struct {
	events.Event
	AutoAllocate bool `json:"auto_allocate"`
}

func (UpdateAutoAllocate) TableName() string { return "yearn_events_update_auto_allocate" }

type UpdatePaused struct {
	events.Event
	Paused bool `json:"paused"`
}

func (UpdatePaused) TableName() string { return "yearn_events_update_paused" }

type UpdatedMaxDebtForStrategy struct {
	events.Event
	Sender   events.Address `json:"sender"`
	Strategy events.Address `json:"strategy"`
	NewDebt  events.Number  `json:"new_debt"`
}

func (UpdatedMaxDebtForStrategy) TableName() string {
	return "yearn_events_updated_max_debt_for_strategy"
}

type UpdateDepositLimit struct {
	events.Event
	DepositLimit events.Number `json:"deposit_limit"`
}

func (UpdateDepositLimit) TableName() string { return "yearn_events_update_deposit_limit" }

type UpdateMinimumTotalIdle struct {
	events.Event
	MinimumTotalIdle events.Number `json:"minimum_total_idle"`
}

func (UpdateMinimumTotalIdle) TableName() string { return "yearn_events_update_minimum_total_idle" }

type UpdateProfitMaxUnlockTime struct {
	events.Event
	ProfitMaxUnlockTime events.Number `json:"profit_max_unlock_time"`
}

func (UpdateProfitMaxUnlockTime) TableName() string {
	return "yearn_events_update_profit_max_unlock_time"
}

type DebtPurchased struct {
	events.Event
	Strategy events.Address `json:"strategy"`
	Amount   events.Number  `json:"amount"`
}

func (DebtPurchased) TableName() string { return "yearn_events_debt_purchased" }

type Shutdown struct {
	events.Event
}

func (Shutdown) TableName() string { return "yearn_events_shutdown" }

type NewVault struct {
	events.Event
	VaultAddress events.Address `json:"vault_address"`
	Asset        events.Address `json:"asset"`
}

func (NewVault) TableName() string { return "yearn_events_new_vault" }

type UpdateProtocolFeeBps struct {
	events.Event
	OldFeeBps uint16 `json:"old_fee_bps"`
	NewFeeBps uint16 `json:"new_fee_bps"`
}

func (UpdateProtocolFeeBps) TableName() string { return "yearn_events_update_protocol_fee_bps" }

type UpdateProtocolFeeRecipient struct {
	events.Event
	OldFeeRecipient events.Address `json:"old_fee_recipient"`
	NewFeeRecipient events.Address `json:"new_fee_recipient"`
}

func (UpdateProtocolFeeRecipient) TableName() string {
	return "yearn_events_update_protocol_fee_recipient"
}

type UpdateCustomProtocolFee struct {
	events.Event
	Vault                events.Address `json:"vault"`
	NewCustomProtocolFee uint16         `json:"new_custom_protocol_fee"`
}

func (UpdateCustomProtocolFee) TableName() string { return "yearn_events_update_custom_protocol_fee" }

type RemovedCustomProtocolFee struct {
	events.Event
	Vault events.Address `json:"vault"`
}

func (RemovedCustomProtocolFee) TableName() string { return "yearn_events_removed_custom_protocol_fee" }

type FactoryShutdown struct {
	events.Event
}

func (FactoryShutdown) TableName() string { return "yearn_events_factory_shutdown" }

type GovernanceTransferred struct {
	events.Event
	PreviousGovernance events.Address `json:"previous_governance"`
	NewGovernance      events.Address `json:"new_governance"`
}

func (GovernanceTransferred) TableName() string { return "yearn_events_governance_transferred" }

type UpdatePendingGovernance struct {
	events.Event
	NewPendingGovernance events.Address `json:"new_pending_governance"`
}

func (UpdatePendingGovernance) TableName() string { return "yearn_events_update_pending_governance" }

func eventValue(name string, v []any) any {
	switch name {
	case "Deposit":
		return &Deposit{
			Sender: events.AddressFromCommon(v[0].(common.Address)),
			Owner:  events.AddressFromCommon(v[1].(common.Address)),
			Assets: events.NumberFromBig(v[2].(*big.Int)),
			Shares: events.NumberFromBig(v[3].(*big.Int)),
		}
	case "Withdraw":
		return &Withdraw{
			Sender:   events.AddressFromCommon(v[0].(common.Address)),
			Receiver: events.AddressFromCommon(v[1].(common.Address)),
			Owner:    events.AddressFromCommon(v[2].(common.Address)),
			Assets:   events.NumberFromBig(v[3].(*big.Int)),
			Shares:   events.NumberFromBig(v[4].(*big.Int)),
		}
	case "Transfer":
		return &Transfer{
			Sender:   events.AddressFromCommon(v[0].(common.Address)),
			Receiver: events.AddressFromCommon(v[1].(common.Address)),
			Value:    events.NumberFromBig(v[2].(*big.Int)),
		}
	case "Approval":
		return &Approval{
			Owner:   events.AddressFromCommon(v[0].(common.Address)),
			Spender: events.AddressFromCommon(v[1].(common.Address)),
			Value:   events.NumberFromBig(v[2].(*big.Int)),
		}
	case "StrategyChanged":
		return &StrategyChanged{
			Strategy:   events.AddressFromCommon(v[0].(common.Address)),
			ChangeType: events.NumberFromBig(v[1].(*big.Int)),
		}
	case "StrategyReported":
		return &StrategyReported{
			Strategy:     events.AddressFromCommon(v[0].(common.Address)),
			Gain:         events.NumberFromBig(v[1].(*big.Int)),
			Loss:         events.NumberFromBig(v[2].(*big.Int)),
			CurrentDebt:  events.NumberFromBig(v[3].(*big.Int)),
			ProtocolFees: events.NumberFromBig(v[4].(*big.Int)),
			TotalFees:    events.NumberFromBig(v[5].(*big.Int)),
			TotalRefunds: events.NumberFromBig(v[6].(*big.Int)),
		}
	case "DebtUpdated":
		return &DebtUpdated{
			Strategy:    events.AddressFromCommon(v[0].(common.Address)),
			CurrentDebt: events.NumberFromBig(v[1].(*big.Int)),
			NewDebt:     events.NumberFromBig(v[2].(*big.Int)),
		}
	case "RoleSet":
		return &RoleSet{
			Account: events.AddressFromCommon(v[0].(common.Address)),
			Role:    events.NumberFromBig(v[1].(*big.Int)),
		}
	case "UpdateFutureRoleManager":
		return &UpdateFutureRoleManager{
			FutureRoleManager: events.AddressFromCommon(v[0].(common.Address)),
		}
	case "UpdateRoleManager":
		return &UpdateRoleManager{
			RoleManager: events.AddressFromCommon(v[0].(common.Address)),
		}
	case "UpdateAccountant":
		return &UpdateAccountant{
			Accountant: events.AddressFromCommon(v[0].(common.Address)),
		}
	case "UpdateDepositHook":
		return &UpdateDepositHook{
			DepositHook: events.AddressFromCommon(v[0].(common.Address)),
		}
	case "UpdateWithdrawHook":
		return &UpdateWithdrawHook{
			WithdrawHook: events.AddressFromCommon(v[0].(common.Address)),
		}
	case "UpdateTransferHook":
		return &UpdateTransferHook{
			TransferHook: events.AddressFromCommon(v[0].(common.Address)),
		}
	case "UpdateDefaultQueue":
		return &UpdateDefaultQueue{
			NewDefaultQueue: addressArray(v[0].([]common.Address)),
		}
	case "UpdateUseDefaultQueue":
		return &UpdateUseDefaultQueue{
			UseDefaultQueue: v[0].(bool),
		}
	case "UpdateAutoAllocate":
		return &UpdateAutoAllocate{
			AutoAllocate: v[0].(bool),
		}
	case "UpdatePaused":
		return &UpdatePaused{
			Paused: v[0].(bool),
		}
	case "UpdatedMaxDebtForStrategy":
		return &UpdatedMaxDebtForStrategy{
			Sender:   events.AddressFromCommon(v[0].(common.Address)),
			Strategy: events.AddressFromCommon(v[1].(common.Address)),
			NewDebt:  events.NumberFromBig(v[2].(*big.Int)),
		}
	case "UpdateDepositLimit":
		return &UpdateDepositLimit{
			DepositLimit: events.NumberFromBig(v[0].(*big.Int)),
		}
	case "UpdateMinimumTotalIdle":
		return &UpdateMinimumTotalIdle{
			MinimumTotalIdle: events.NumberFromBig(v[0].(*big.Int)),
		}
	case "UpdateProfitMaxUnlockTime":
		return &UpdateProfitMaxUnlockTime{
			ProfitMaxUnlockTime: events.NumberFromBig(v[0].(*big.Int)),
		}
	case "DebtPurchased":
		return &DebtPurchased{
			Strategy: events.AddressFromCommon(v[0].(common.Address)),
			Amount:   events.NumberFromBig(v[1].(*big.Int)),
		}
	case "Shutdown":
		return &Shutdown{}
	case "NewVault":
		return &NewVault{
			VaultAddress: events.AddressFromCommon(v[0].(common.Address)),
			Asset:        events.AddressFromCommon(v[1].(common.Address)),
		}
	case "UpdateProtocolFeeBps":
		return &UpdateProtocolFeeBps{
			OldFeeBps: v[0].(uint16),
			NewFeeBps: v[1].(uint16),
		}
	case "UpdateProtocolFeeRecipient":
		return &UpdateProtocolFeeRecipient{
			OldFeeRecipient: events.AddressFromCommon(v[0].(common.Address)),
			NewFeeRecipient: events.AddressFromCommon(v[1].(common.Address)),
		}
	case "UpdateCustomProtocolFee":
		return &UpdateCustomProtocolFee{
			Vault:                events.AddressFromCommon(v[0].(common.Address)),
			NewCustomProtocolFee: v[1].(uint16),
		}
	case "RemovedCustomProtocolFee":
		return &RemovedCustomProtocolFee{
			Vault: events.AddressFromCommon(v[0].(common.Address)),
		}
	case "FactoryShutdown":
		return &FactoryShutdown{}
	case "GovernanceTransferred":
		return &GovernanceTransferred{
			PreviousGovernance: events.AddressFromCommon(v[0].(common.Address)),
			NewGovernance:      events.AddressFromCommon(v[1].(common.Address)),
		}
	case "UpdatePendingGovernance":
		return &UpdatePendingGovernance{
			NewPendingGovernance: events.AddressFromCommon(v[0].(common.Address)),
		}
	default:
		panic("yearn: missing event constructor: " + name)
	}
}

func addressArray(addresses []common.Address) pq.StringArray {
	out := make(pq.StringArray, len(addresses))
	for i, address := range addresses {
		out[i] = events.AddressFromCommon(address).String()
	}
	return out
}
